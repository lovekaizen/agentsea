/**
 * Kubernetes pod backend
 *
 * Runs a desktop environment in a Kubernetes pod and drives it with the same
 * `xdotool` / `scrot` approach as the Docker backend, but over `kubectl exec`
 * instead of `docker exec`. Requires `kubectl` on PATH and an image that ships
 * an X server plus xdotool/scrot (e.g. the same desktop image used for Docker).
 *
 * The exec transport is injectable so the command translation is unit-testable
 * without a live cluster.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

import { BaseBackend } from '../base-backend';
import {
  Point,
  ScreenDimensions,
  ScreenshotResult,
  ActionResult,
  ScrollDirection,
  ModifierKey,
  ScreenshotOptions,
  ClickOptions,
  TypeOptions,
  ScrollOptions,
  DragOptions,
  KubernetesBackendOptions,
} from '../../types';

const execAsync = promisify(exec);

/** Minimal shell-exec contract (so tests can avoid touching a real cluster). */
export type ExecFn = (
  cmd: string,
) => Promise<{ stdout: string; stderr: string }>;

export interface KubernetesBackendDeps {
  /** Inject a shell-exec implementation (defaults to child_process exec). */
  exec?: ExecFn;
}

export class KubernetesBackend extends BaseBackend {
  readonly name = 'kubernetes-pod';

  private options: KubernetesBackendOptions;
  private podName: string | null = null;
  private readonly resolution: ScreenDimensions;
  private readonly exec: ExecFn;

  constructor(
    options: KubernetesBackendOptions,
    deps: KubernetesBackendDeps = {},
  ) {
    super();
    this.options = {
      displayServer: 'xvfb',
      resolution: { width: 1920, height: 1080, scaleFactor: 1 },
      deleteOnDisconnect: true,
      ...options,
    };
    this.resolution = this.options.resolution!;
    this.exec = deps.exec ?? (execAsync as ExecFn);
  }

  private get ns(): string {
    return this.options.namespace;
  }

  async connect(): Promise<void> {
    try {
      await this.exec('kubectl version --client');
    } catch {
      throw new Error(
        'kubectl is required but not installed or not configured',
      );
    }

    const podName = this.options.podName || `agentsea-desktop-${Date.now()}`;
    const res = this.resolution;

    const resourceArgs = this.buildResourceArgs();
    const runCmd =
      `kubectl run ${podName} --namespace ${this.ns} --image ${this.options.image} ` +
      `--restart=Never --env DISPLAY=:99 ` +
      `--env RESOLUTION=${res.width}x${res.height}${resourceArgs}`;

    try {
      await this.exec(runCmd);
      this.podName = podName;
      await this.waitForPod();
      this._isConnected = true;
    } catch (error) {
      throw new Error(
        `Failed to start Kubernetes pod: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private buildResourceArgs(): string {
    const r = this.options.resources;
    if (!r) return '';
    const parts: string[] = [];
    const reqs: string[] = [];
    const lims: string[] = [];
    if (r.requests?.cpu) reqs.push(`cpu=${r.requests.cpu}`);
    if (r.requests?.memory) reqs.push(`memory=${r.requests.memory}`);
    if (r.limits?.cpu) lims.push(`cpu=${r.limits.cpu}`);
    if (r.limits?.memory) lims.push(`memory=${r.limits.memory}`);
    if (reqs.length) parts.push(`--requests=${reqs.join(',')}`);
    if (lims.length) parts.push(`--limits=${lims.join(',')}`);
    return parts.length ? ` ${parts.join(' ')}` : '';
  }

  /** Poll until the pod reports Running (bounded). */
  private async waitForPod(maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const { stdout } = await this.exec(
          `kubectl get pod ${this.podName} --namespace ${this.ns} -o jsonpath={.status.phase}`,
        );
        if (stdout.trim() === 'Running') return;
      } catch {
        // pod may not be visible yet; keep polling
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Pod ${this.podName} did not reach Running state`);
  }

  async disconnect(): Promise<void> {
    if (this.podName && this.options.deleteOnDisconnect) {
      try {
        await this.exec(
          `kubectl delete pod ${this.podName} --namespace ${this.ns} --ignore-not-found`,
        );
      } catch {
        // ignore cleanup errors
      }
    }
    this.podName = null;
    this._isConnected = false;
  }

  getScreenDimensions(): Promise<ScreenDimensions> {
    return Promise.resolve(this.resolution);
  }

  /** Run a command inside the pod via `kubectl exec`. */
  private execInPod(
    command: string,
  ): Promise<{ stdout: string; stderr: string }> {
    return this.exec(
      `kubectl exec ${this.podName} --namespace ${this.ns} -- ${command}`,
    );
  }

  async screenshot(options?: ScreenshotOptions): Promise<ScreenshotResult> {
    this.ensureConnected();

    try {
      const remoteFile = `/tmp/screenshot-${Date.now()}.png`;
      const scrot = options?.region
        ? `scrot -a ${options.region.x},${options.region.y},${options.region.width},${options.region.height} ${remoteFile}`
        : `scrot ${remoteFile}`;
      await this.execInPod(scrot);

      const localPath = `/tmp/screenshot-k8s-${Date.now()}.png`;
      await this.exec(
        `kubectl cp ${this.ns}/${this.podName}:${remoteFile} ${localPath}`,
      );

      const fs = await import('fs');
      const imageBuffer = fs.readFileSync(localPath);
      const base64 = imageBuffer.toString('base64');
      fs.unlinkSync(localPath);
      await this.execInPod(`rm ${remoteFile}`).catch(() => undefined);

      return {
        image: imageBuffer,
        base64,
        mimeType: 'image/png',
        dimensions: this.resolution,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(
        `Screenshot failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async click(point: Point, options?: ClickOptions): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();
    try {
      const button = this.mapButton(options?.button || 'left');
      await this.execInPod(
        `xdotool mousemove ${point.x} ${point.y} click ${button}`,
      );
      return this.createSuccessResult('click', startTime);
    } catch (error) {
      return this.createErrorResult(
        'click',
        startTime,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  async doubleClick(
    point: Point,
    options?: ClickOptions,
  ): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();
    try {
      const button = this.mapButton(options?.button || 'left');
      await this.execInPod(
        `xdotool mousemove ${point.x} ${point.y} click --repeat 2 --delay 100 ${button}`,
      );
      return this.createSuccessResult('doubleClick', startTime);
    } catch (error) {
      return this.createErrorResult(
        'doubleClick',
        startTime,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  async typeText(text: string, options?: TypeOptions): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();
    try {
      if (options?.point) {
        await this.click(options.point);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (options?.clearFirst) {
        await this.execInPod('xdotool key ctrl+a Delete');
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const escapedText = text.replace(/'/g, "'\\''");
      const delay = options?.delayMs || 0;
      await this.execInPod(`xdotool type --delay ${delay} '${escapedText}'`);
      return this.createSuccessResult('typeText', startTime);
    } catch (error) {
      return this.createErrorResult(
        'typeText',
        startTime,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  async scroll(
    direction: ScrollDirection,
    point: Point,
    options?: ScrollOptions,
  ): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();
    try {
      // xdotool wheel buttons: 4 up, 5 down, 6 left, 7 right.
      const button = { up: 4, down: 5, left: 6, right: 7 }[direction];
      const clicks = options?.amount || 3;
      await this.execInPod(
        `xdotool mousemove ${point.x} ${point.y} click --repeat ${clicks} ${button}`,
      );
      return this.createSuccessResult('scroll', startTime);
    } catch (error) {
      return this.createErrorResult(
        'scroll',
        startTime,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  async drag(
    from: Point,
    to: Point,
    options?: DragOptions,
  ): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();
    try {
      const button = this.mapButton(options?.button || 'left');
      await this.execInPod(
        `xdotool mousemove ${from.x} ${from.y} mousedown ${button} ` +
          `mousemove ${to.x} ${to.y} mouseup ${button}`,
      );
      return this.createSuccessResult('drag', startTime);
    } catch (error) {
      return this.createErrorResult(
        'drag',
        startTime,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  async keyPress(
    key: string,
    modifiers?: ModifierKey[],
  ): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();
    try {
      const combo = [
        ...(modifiers ?? []).map((m) => this.mapModifier(m)),
        key,
      ].join('+');
      await this.execInPod(`xdotool key ${combo}`);
      return this.createSuccessResult('keyPress', startTime);
    } catch (error) {
      return this.createErrorResult(
        'keyPress',
        startTime,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  async moveCursor(point: Point): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();
    try {
      await this.execInPod(`xdotool mousemove ${point.x} ${point.y}`);
      return this.createSuccessResult('moveCursor', startTime);
    } catch (error) {
      return this.createErrorResult(
        'moveCursor',
        startTime,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  private mapButton(button: string): number {
    return { left: 1, middle: 2, right: 3 }[button] ?? 1;
  }

  private mapModifier(modifier: ModifierKey): string {
    const map: Record<ModifierKey, string> = {
      ctrl: 'ctrl',
      alt: 'alt',
      shift: 'shift',
      meta: 'super',
      command: 'super',
      win: 'super',
    };
    return map[modifier] ?? 'ctrl';
  }
}

export function createKubernetesBackend(
  options: KubernetesBackendOptions,
  deps?: KubernetesBackendDeps,
): KubernetesBackend {
  return new KubernetesBackend(options, deps);
}
