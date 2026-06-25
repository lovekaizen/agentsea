/**
 * Unit tests for the native OS backends (macOS / Linux / Windows).
 *
 * Strategy: the backends issue all shell work through `promisify(exec)` from
 * `child_process`. We mock `child_process.exec` with a callback-style stub so
 * `promisify` wraps it normally, capture every command string, and assert the
 * exact shell / AppleScript / xdotool / PowerShell invocation each method
 * generates. `fs` is mocked so screenshot reads of a fake PNG succeed without
 * touching disk. `process.platform` is overridden per-suite so `connect()`
 * passes on a CI host of any OS.
 *
 * These tests assert ACTUAL current behavior; no source logic is changed.
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';

// ---- Mocks ----------------------------------------------------------------

// Captured exec commands for the current test.
let execCalls: string[] = [];
// Optional per-command stdout resolver (Windows PowerShell is base64-encoded).
let execStdout: (cmd: string) => string = () => '';

vi.mock('child_process', () => {
  const exec = vi.fn((cmd: string, arg2?: unknown, arg3?: unknown): unknown => {
    execCalls.push(cmd);
    // The real exec signature is exec(cmd, [options], callback). promisify
    // always passes the callback last.
    const cb = (typeof arg2 === 'function' ? arg2 : arg3) as
      | ((err: unknown, res: { stdout: string; stderr: string }) => void)
      | undefined;
    if (cb) {
      cb(null, { stdout: execStdout(cmd), stderr: '' });
    }
    return {};
  });
  return { exec };
});

vi.mock('fs', () => {
  const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(() => fakePng),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    readdirSync: vi.fn(() => []),
  };
});

import { MacOSBackend } from '../backends/native/macos-backend.js';
import { LinuxBackend } from '../backends/native/linux-backend.js';
import { WindowsBackend } from '../backends/native/windows-backend.js';

/** Decode a Windows `powershell -EncodedCommand <base64>` call to its script. */
function decodePowerShell(cmd: string): string {
  const match = cmd.match(/-EncodedCommand\s+([A-Za-z0-9+/=]+)/);
  if (!match) return cmd;
  return Buffer.from(match[1], 'base64').toString('utf16le');
}

/** The full decoded PowerShell text of every captured exec call, joined. */
function allPowerShell(): string {
  return execCalls.map(decodePowerShell).join('\n---\n');
}

function setPlatform(platform: NodeJS.Platform): () => void {
  const original = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true,
  });
  return () => {
    if (original) Object.defineProperty(process, 'platform', original);
  };
}

beforeEach(() => {
  execCalls = [];
  execStdout = () => '';
});

afterEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// macOS backend
// ===========================================================================
describe('MacOSBackend', () => {
  let restore: () => void;
  let backend: MacOSBackend;

  beforeEach(async () => {
    restore = setPlatform('darwin');
    backend = new MacOSBackend();
    await backend.connect();
    execCalls = []; // drop the connect() probe call
  });

  afterEach(() => {
    restore();
  });

  it('connect() probes accessibility via osascript/System Events', async () => {
    execCalls = [];
    const b = new MacOSBackend();
    await b.connect();
    expect(b.isConnected).toBe(true);
    expect(execCalls.some((c) => c.includes('osascript'))).toBe(true);
    expect(execCalls.some((c) => c.includes('System Events'))).toBe(true);
  });

  it('screenshot() invokes screencapture and returns a buffer + base64', async () => {
    const result = await backend.screenshot();
    expect(execCalls.some((c) => c.startsWith('screencapture -x'))).toBe(true);
    expect(execCalls.some((c) => c.includes('-t png'))).toBe(true);
    expect(result.image.length).toBeGreaterThan(0);
    expect(result.base64.length).toBeGreaterThan(0);
    expect(result.mimeType).toBe('image/png');
  });

  it('screenshot() with region passes -R x,y,w,h', async () => {
    await backend.screenshot({
      region: { x: 10, y: 20, width: 100, height: 200 },
    });
    expect(execCalls.some((c) => c.includes('-R 10,20,100,200'))).toBe(true);
  });

  it('click() emits an osascript "click at {x, y}"', async () => {
    const res = await backend.click({ x: 42, y: 84 });
    expect(res.success).toBe(true);
    const joined = execCalls.join('\n');
    expect(joined).toContain('osascript');
    expect(joined).toContain('click at {42, 84}');
  });

  it('click() with modifiers presses and releases via key down/up', async () => {
    await backend.click({ x: 5, y: 6 }, { modifiers: ['command', 'shift'] });
    const joined = execCalls.join('\n');
    expect(joined).toContain('key down {command down, shift down}');
    expect(joined).toContain('key up {command down, shift down}');
  });

  it('click() right-button uses control-down click', async () => {
    await backend.click({ x: 7, y: 8 }, { button: 'right' });
    expect(execCalls.join('\n')).toContain('with control down');
  });

  it('typeText() uses keystroke', async () => {
    await backend.typeText('hello');
    expect(execCalls.join('\n')).toContain('keystroke "hello"');
  });

  it('keyPress() of a special key uses "key code" with modifiers', async () => {
    await backend.keyPress('enter', ['command']);
    const joined = execCalls.join('\n');
    expect(joined).toContain('key code 36');
    expect(joined).toContain('using {command down}');
  });

  it('keyPress() of a normal char uses keystroke', async () => {
    await backend.keyPress('a');
    expect(execCalls.join('\n')).toContain('keystroke "a"');
  });

  it('scroll() emits an AppleScript scroll command', async () => {
    const res = await backend.scroll('down', { x: 100, y: 100 });
    expect(res.success).toBe(true);
    expect(execCalls.join('\n')).toContain('scroll');
  });

  it('drag() emits an AppleScript drag from start to end', async () => {
    await backend.drag({ x: 0, y: 0 }, { x: 50, y: 60 });
    const joined = execCalls.join('\n');
    expect(joined).toContain('drag startPoint to endPoint');
  });

  it('moveCursor() shells out (Quartz/cliclick path)', async () => {
    const res = await backend.moveCursor({ x: 11, y: 22 });
    expect(res.success).toBe(true);
    expect(execCalls.length).toBeGreaterThan(0);
  });

  it('returns an error result when osascript fails', async () => {
    execStdout = () => {
      throw new Error('boom');
    };
    // Make exec throw for this call by overriding the mock behavior.
    const cp = await import('child_process');
    (cp.exec as unknown as Mock).mockImplementationOnce(
      (_cmd: string, _a: unknown, cb: unknown) => {
        const fn =
          typeof _a === 'function'
            ? (_a as (e: unknown) => void)
            : (cb as (e: unknown) => void);
        fn(new Error('osascript failed'));
        return {};
      },
    );
    const res = await backend.click({ x: 1, y: 1 });
    expect(res.success).toBe(false);
    expect(res.error).toContain('osascript failed');
  });
});

// ===========================================================================
// Linux backend
// ===========================================================================
describe('LinuxBackend', () => {
  let restore: () => void;
  let backend: LinuxBackend;

  beforeEach(async () => {
    restore = setPlatform('linux');
    backend = new LinuxBackend();
    // `which xdotool` and `which scrot` both resolve via the mock.
    await backend.connect();
    execCalls = [];
  });

  afterEach(() => {
    restore();
  });

  it('connect() checks for xdotool and scrot', async () => {
    execCalls = [];
    const b = new LinuxBackend();
    await b.connect();
    expect(execCalls).toContain('which xdotool');
    expect(execCalls).toContain('which scrot');
    expect(b.isConnected).toBe(true);
  });

  it('click() moves the mouse then clicks button 1 by default', async () => {
    const res = await backend.click({ x: 30, y: 40 });
    expect(res.success).toBe(true);
    expect(execCalls).toContain('xdotool mousemove 30 40');
    expect(execCalls.some((c) => c.includes('click 1'))).toBe(true);
  });

  it('click() maps right button to xdotool button 3', async () => {
    await backend.click({ x: 1, y: 2 }, { button: 'right' });
    expect(execCalls.some((c) => c.includes('click 3'))).toBe(true);
  });

  it('click() wraps the click with keydown/keyup for modifiers', async () => {
    await backend.click({ x: 1, y: 2 }, { modifiers: ['ctrl', 'shift'] });
    const clickCmd = execCalls.find((c) => c.includes('click'));
    expect(clickCmd).toBeDefined();
    expect(clickCmd).toContain('keydown ctrl');
    expect(clickCmd).toContain('keydown shift');
    expect(clickCmd).toContain('keyup ctrl');
    expect(clickCmd).toContain('keyup shift');
  });

  it('typeText() uses xdotool type with shell-escaped text', async () => {
    await backend.typeText("it's fine");
    const typeCmd = execCalls.find((c) => c.startsWith('xdotool type'));
    expect(typeCmd).toBeDefined();
    // single quote is escaped as '\'' for the shell
    expect(typeCmd).toContain("it'\\''s fine");
  });

  it('scroll() maps down to xdotool button 5 with repeat', async () => {
    await backend.scroll('down', { x: 5, y: 5 }, { amount: 4 });
    expect(execCalls).toContain('xdotool mousemove 5 5');
    expect(execCalls).toContain('xdotool click --repeat 4 5');
  });

  it('scroll() maps up to button 4', async () => {
    await backend.scroll('up', { x: 0, y: 0 });
    expect(execCalls.some((c) => c.includes('--repeat 3 4'))).toBe(true);
  });

  it('keyPress() joins modifiers with + before the key', async () => {
    await backend.keyPress('a', ['ctrl', 'shift']);
    expect(execCalls).toContain('xdotool key ctrl+shift+a');
  });

  it('keyPress() maps named keys (enter -> Return)', async () => {
    await backend.keyPress('enter');
    expect(execCalls).toContain('xdotool key Return');
  });

  it('drag() presses, steps, then releases the mouse button', async () => {
    await backend.drag({ x: 0, y: 0 }, { x: 10, y: 0 }, { steps: 2 });
    expect(execCalls).toContain('xdotool mousedown 1');
    expect(execCalls).toContain('xdotool mouseup 1');
    // intermediate mousemove toward the target
    expect(execCalls.some((c) => /xdotool mousemove (5|10) 0/.test(c))).toBe(
      true,
    );
  });

  it('moveCursor() emits xdotool mousemove', async () => {
    await backend.moveCursor({ x: 9, y: 9 });
    expect(execCalls).toContain('xdotool mousemove 9 9');
  });

  it('screenshot() uses scrot and returns a buffer', async () => {
    const res = await backend.screenshot();
    expect(execCalls.some((c) => c.startsWith('scrot'))).toBe(true);
    expect(res.image.length).toBeGreaterThan(0);
  });

  it('screenshot() with region passes scrot -a x,y,w,h', async () => {
    await backend.screenshot({
      region: { x: 1, y: 2, width: 3, height: 4 },
    });
    expect(execCalls.some((c) => c.includes('-a 1,2,3,4'))).toBe(true);
  });
});

// ===========================================================================
// Windows backend (PowerShell, incl. the new sendKey / virtualKeyCode logic)
// ===========================================================================
describe('WindowsBackend', () => {
  let restore: () => void;
  let backend: WindowsBackend;

  beforeEach(async () => {
    restore = setPlatform('win32');
    backend = new WindowsBackend();
    await backend.connect();
    execCalls = [];
  });

  afterEach(() => {
    restore();
  });

  it('connect() verifies PowerShell availability', async () => {
    execCalls = [];
    const b = new WindowsBackend();
    await b.connect();
    expect(b.isConnected).toBe(true);
    expect(execCalls.some((c) => c.includes('powershell'))).toBe(true);
  });

  it('click() generates SetCursorPos and a left mouse_event', async () => {
    const res = await backend.click({ x: 100, y: 200 });
    expect(res.success).toBe(true);
    const ps = allPowerShell();
    expect(ps).toContain('SetCursorPos(100, 200)');
    expect(ps).toContain('mouse_event(0x0002'); // left down
    expect(ps).toContain('mouse_event(0x0004'); // left up
  });

  it('click() right button uses 0x0008 / 0x0010 mouse events', async () => {
    await backend.click({ x: 1, y: 1 }, { button: 'right' });
    const ps = allPowerShell();
    expect(ps).toContain('mouse_event(0x0008');
    expect(ps).toContain('mouse_event(0x0010');
  });

  // ---- The newly implemented modifier-via-sendKey logic ----
  it('click() with CTRL modifier calls keybd_event with VK 17 (0x11) down then KEYUP', async () => {
    await backend.click({ x: 5, y: 5 }, { modifiers: ['ctrl'] });
    const ps = allPowerShell();
    // keybd_event(vk, scan, flags, extra) — down has flags 0, up has 0x0002.
    expect(ps).toContain('keybd_event(17, 0, 0, 0)'); // CTRL down
    expect(ps).toContain('keybd_event(17, 0, 2, 0)'); // CTRL up (KEYEVENTF_KEYUP = 0x0002 = 2)
  });

  it('click() with ALT modifier uses VK 18 (0x12)', async () => {
    await backend.click({ x: 5, y: 5 }, { modifiers: ['alt'] });
    const ps = allPowerShell();
    expect(ps).toContain('keybd_event(18, 0, 0, 0)');
    expect(ps).toContain('keybd_event(18, 0, 2, 0)');
  });

  it('click() with SHIFT modifier uses VK 16 (0x10)', async () => {
    await backend.click({ x: 5, y: 5 }, { modifiers: ['shift'] });
    const ps = allPowerShell();
    expect(ps).toContain('keybd_event(16, 0, 0, 0)');
    expect(ps).toContain('keybd_event(16, 0, 2, 0)');
  });

  it('click() with meta/win modifier uses VK 91 (0x5b)', async () => {
    await backend.click({ x: 5, y: 5 }, { modifiers: ['meta'] });
    const ps = allPowerShell();
    expect(ps).toContain('keybd_event(91, 0, 0, 0)');
    expect(ps).toContain('keybd_event(91, 0, 2, 0)');
  });

  it('click() emits the keybd_event before SetCursorPos and the keyup after', async () => {
    await backend.click({ x: 5, y: 5 }, { modifiers: ['ctrl'] });
    const decoded = execCalls.map(decodePowerShell);
    const downIdx = decoded.findIndex((s) =>
      s.includes('keybd_event(17, 0, 0, 0)'),
    );
    const clickIdx = decoded.findIndex((s) => s.includes('SetCursorPos(5, 5)'));
    const upIdx = decoded.findIndex((s) =>
      s.includes('keybd_event(17, 0, 2, 0)'),
    );
    expect(downIdx).toBeGreaterThanOrEqual(0);
    expect(clickIdx).toBeGreaterThan(downIdx);
    expect(upIdx).toBeGreaterThan(clickIdx);
  });

  it('typeText() uses SendKeys.SendWait', async () => {
    await backend.typeText('hi');
    expect(allPowerShell()).toContain(
      '[System.Windows.Forms.SendKeys]::SendWait("hi")',
    );
  });

  it('typeText() escapes SendKeys metacharacters in a single pass', async () => {
    // Each metacharacter is wrapped in braces exactly once: + -> {+}.
    await backend.typeText('a+b');
    expect(allPowerShell()).toContain('a{+}b');
  });

  it('typeText() escapes literal braces correctly', async () => {
    // { -> {{}  and  } -> {}}  without re-escaping the wrapper braces.
    await backend.typeText('{}');
    expect(allPowerShell()).toContain('{{}{}}');
  });

  it('keyPress() maps a named key and prepends modifier symbols', async () => {
    await backend.keyPress('enter', ['ctrl', 'shift']);
    const ps = allPowerShell();
    // ctrl -> ^, shift -> +, enter -> {ENTER}
    expect(ps).toContain('^');
    expect(ps).toContain('+');
    expect(ps).toContain('{ENTER}');
  });

  it('keyPress() fails loudly for the Windows key (no SendKeys encoding)', async () => {
    // Must not silently send Ctrl in place of the Windows key.
    const result = await backend.keyPress('d', ['meta']);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cannot be sent via SendKeys/i);
  });

  it('scroll() down emits a negative wheel delta', async () => {
    await backend.scroll('down', { x: 0, y: 0 }, { amount: 2 });
    const ps = allPowerShell();
    expect(ps).toContain('mouse_event(0x0800, 0, 0, -240, 0)');
  });

  it('scroll() up emits a positive wheel delta', async () => {
    await backend.scroll('up', { x: 0, y: 0 }, { amount: 1 });
    expect(allPowerShell()).toContain('mouse_event(0x0800, 0, 0, 120, 0)');
  });

  it('moveCursor() emits SetCursorPos', async () => {
    await backend.moveCursor({ x: 33, y: 44 });
    expect(allPowerShell()).toContain('SetCursorPos(33, 44)');
  });

  it('drag() presses left down, steps, and releases left up', async () => {
    await backend.drag({ x: 0, y: 0 }, { x: 10, y: 0 });
    const ps = allPowerShell();
    expect(ps).toContain('mouse_event(0x0002'); // down
    expect(ps).toContain('mouse_event(0x0004'); // up
    expect(ps).toContain('SetCursorPos(10, 0)'); // reached target
  });

  it('screenshot() runs PowerShell and returns a buffer', async () => {
    const res = await backend.screenshot();
    expect(allPowerShell()).toContain('CopyFromScreen');
    expect(res.image.length).toBeGreaterThan(0);
    expect(res.mimeType).toBe('image/png');
  });

  // ---- virtualKeyCode / sendKey direct coverage --------------------------
  // These are private helpers. They are only reachable internally from click()
  // for the supported modifier set (which always maps to CTRL/ALT/SHIFT/WIN),
  // so the "unsupported key" branch cannot be triggered through the public
  // click() path. We exercise the helpers directly to cover the throw and the
  // VK-code mapping, which is the implemented behavior under test.
  it('virtualKeyCode() maps modifier names to Win32 VK codes (case-insensitive)', () => {
    const vk = (k: string): number | undefined =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (backend as any).virtualKeyCode(k);
    expect(vk('CTRL')).toBe(0x11);
    expect(vk('control')).toBe(0x11);
    expect(vk('ALT')).toBe(0x12);
    expect(vk('shift')).toBe(0x10);
    expect(vk('WIN')).toBe(0x5b);
    expect(vk('meta')).toBe(0x5b);
    expect(vk('command')).toBe(0x5b);
    expect(vk('F1')).toBeUndefined();
  });

  it('sendKey() throws a clear error for an unsupported key', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (backend as any).sendKey('TAB', true),
    ).rejects.toThrow(/cannot send unsupported key "TAB"/);
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (backend as any).sendKey('TAB', true),
    ).rejects.toThrow(/Supported modifier keys: CTRL, ALT, SHIFT, WIN/);
  });

  it('sendKey() down emits flags 0; up emits KEYEVENTF_KEYUP (0x0002)', async () => {
    execCalls = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (backend as any).sendKey('CTRL', true);
    expect(allPowerShell()).toContain('keybd_event(17, 0, 0, 0)');
    execCalls = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (backend as any).sendKey('CTRL', false);
    expect(allPowerShell()).toContain('keybd_event(17, 0, 2, 0)');
  });
});
