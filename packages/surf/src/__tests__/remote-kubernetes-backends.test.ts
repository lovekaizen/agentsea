/**
 * Unit tests for the Kubernetes / VNC / RDP backends.
 *
 * Kubernetes uses an injected exec fn (asserting the kubectl/xdotool commands);
 * VNC and RDP use an injected RemoteDisplayClient (asserting pointer/key event
 * translation). No live cluster, VNC server, or RDP host is involved. Real
 * transport adapters are thin and covered by guarded integration usage.
 */
import { describe, it, expect, vi } from 'vitest';
import { KubernetesBackend } from '../backends/kubernetes/kubernetes-backend.js';
import { VNCBackend } from '../backends/remote/vnc-backend.js';
import { RDPBackend } from '../backends/remote/rdp-backend.js';
import type { RemoteDisplayClient } from '../backends/remote/remote-display-backend.js';

describe('KubernetesBackend (injected exec)', () => {
  function mockExec() {
    return vi.fn(async (cmd: string) => {
      if (cmd.includes('jsonpath')) return { stdout: 'Running', stderr: '' };
      return { stdout: '', stderr: '' };
    });
  }

  it('runs and waits for the pod on connect', async () => {
    const exec = mockExec();
    const backend = new KubernetesBackend(
      { namespace: 'ns1', podName: 'pod1', image: 'desktop:latest' },
      { exec },
    );

    await backend.connect();
    expect(backend.isConnected).toBe(true);

    const cmds = exec.mock.calls.map((c) => c[0]);
    expect(cmds.some((c) => /kubectl run pod1 --namespace ns1/.test(c))).toBe(
      true,
    );
    expect(cmds.some((c) => /kubectl get pod pod1/.test(c))).toBe(true);
  });

  it('translates a click into a kubectl exec xdotool command', async () => {
    const exec = mockExec();
    const backend = new KubernetesBackend(
      { namespace: 'ns1', podName: 'pod1', image: 'x' },
      { exec },
    );
    await backend.connect();
    exec.mockClear();

    const res = await backend.click({ x: 12, y: 34 }, { button: 'right' });
    expect(res.success).toBe(true);
    expect(exec).toHaveBeenCalledWith(
      'kubectl exec pod1 --namespace ns1 -- xdotool mousemove 12 34 click 3',
    );
  });

  it('deletes the pod on disconnect when configured', async () => {
    const exec = mockExec();
    const backend = new KubernetesBackend(
      {
        namespace: 'ns1',
        podName: 'pod1',
        image: 'x',
        deleteOnDisconnect: true,
      },
      { exec },
    );
    await backend.connect();
    exec.mockClear();

    await backend.disconnect();
    expect(exec).toHaveBeenCalledWith(
      'kubectl delete pod pod1 --namespace ns1 --ignore-not-found',
    );
    expect(backend.isConnected).toBe(false);
  });
});

function fakeClient(): RemoteDisplayClient {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    dimensions: vi.fn().mockReturnValue({ width: 1024, height: 768 }),
    capture: vi.fn().mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
    pointer: vi.fn().mockResolvedValue(undefined),
    key: vi.fn().mockResolvedValue(undefined),
  };
}

describe('VNCBackend (injected client)', () => {
  it('requires host and port', () => {
    expect(() => new VNCBackend({ host: '', port: 0 })).toThrow(/host/);
  });

  it('clicks via a pointer press + release with the right button mask', async () => {
    const client = fakeClient();
    const backend = new VNCBackend({ host: 'h', port: 5900 }, { client });
    await backend.connect();

    await backend.click({ x: 5, y: 6 }, { button: 'right' });
    expect(client.pointer).toHaveBeenNthCalledWith(1, 5, 6, 4); // press (right=bit2)
    expect(client.pointer).toHaveBeenNthCalledWith(2, 5, 6, 0); // release
  });

  it('types text as per-character key down/up using ASCII keysyms', async () => {
    const client = fakeClient();
    const backend = new VNCBackend({ host: 'h', port: 5900 }, { client });
    await backend.connect();

    await backend.typeText('Ab');
    expect(client.key).toHaveBeenCalledWith('A'.charCodeAt(0), true);
    expect(client.key).toHaveBeenCalledWith('A'.charCodeAt(0), false);
    expect(client.key).toHaveBeenCalledWith('b'.charCodeAt(0), true);
  });

  it('keyPress wraps the key in modifier down/up (Enter + ctrl)', async () => {
    const client = fakeClient();
    const backend = new VNCBackend({ host: 'h', port: 5900 }, { client });
    await backend.connect();

    await backend.keyPress('enter', ['ctrl']);
    // ctrl down (0xffe3), Enter down/up (0xff0d), ctrl up
    expect(client.key).toHaveBeenNthCalledWith(1, 0xffe3, true);
    expect(client.key).toHaveBeenNthCalledWith(2, 0xff0d, true);
    expect(client.key).toHaveBeenNthCalledWith(3, 0xff0d, false);
    expect(client.key).toHaveBeenNthCalledWith(4, 0xffe3, false);
  });

  it('screenshots by capturing a framebuffer PNG', async () => {
    const client = fakeClient();
    const backend = new VNCBackend({ host: 'h', port: 5900 }, { client });
    await backend.connect();

    const shot = await backend.screenshot();
    expect(Buffer.isBuffer(shot.image)).toBe(true);
    expect(shot.mimeType).toBe('image/png');
    expect(shot.dimensions).toMatchObject({ width: 1024, height: 768 });
  });
});

describe('RDPBackend (injected client)', () => {
  it('requires host and username', () => {
    expect(
      () => new RDPBackend({ host: '', username: 'u', password: 'p' }),
    ).toThrow(/host/);
  });

  it('translates a drag into pointer press, moves, and release', async () => {
    const client = fakeClient();
    const backend = new RDPBackend(
      { host: 'h', username: 'u', password: 'p' },
      { client },
    );
    await backend.connect();

    await backend.drag({ x: 0, y: 0 }, { x: 10, y: 0 }, { steps: 2 });
    // first press with mask 1, last release with mask 0
    const calls = (client.pointer as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0]).toEqual([0, 0, 1]);
    expect(calls[calls.length - 1]).toEqual([10, 0, 0]);
  });
});
