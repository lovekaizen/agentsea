import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { StdioEnvOptions, StdioTransport, buildStdioEnv } from '../transport';

const SECRETS = {
  ANTHROPIC_API_KEY: 'sk-ant-SENTINEL-1111',
  OPENAI_API_KEY: 'sk-SENTINEL-2222',
  AWS_SECRET_ACCESS_KEY: 'SENTINEL-aws-3333',
  GITHUB_TOKEN: 'ghp_SENTINEL4444',
};

/** Run a real child that prints its environment as one JSON line. */
async function childEnv(
  env?: Record<string, string>,
  options?: ConstructorParameters<typeof StdioTransport>[3],
): Promise<Record<string, string>> {
  const transport = new StdioTransport(
    process.execPath,
    ['-e', 'console.log(JSON.stringify(process.env))'],
    env,
    options,
  );
  let timer: NodeJS.Timeout | undefined;
  const printed = new Promise<Record<string, string>>((resolve, reject) => {
    transport.once('message', (m) => {
      clearTimeout(timer);
      resolve(m as unknown as Record<string, string>);
    });
    // Not `once`: stderr is re-emitted as 'error', and a second one must not
    // reach an EventEmitter with no listener.
    transport.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    timer = setTimeout(
      () => reject(new Error('child printed nothing')),
      10_000,
    );
  });
  try {
    await transport.connect();
    return await printed;
  } finally {
    clearTimeout(timer);
    transport.close();
  }
}

describe('stdio server environment', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const [k, v] of Object.entries({
      ...SECRETS,
      CUSTOM_UNLISTED: 'x',
      HTTPS_PROXY: 'http://proxy.test',
    })) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('does not leak provider keys or other parent variables to the child', async () => {
    const env = await childEnv();
    for (const key of Object.keys(SECRETS)) expect(env[key]).toBeUndefined();
    expect(env.CUSTOM_UNLISTED).toBeUndefined();
    expect(JSON.stringify(env)).not.toContain('SENTINEL');
  });

  it('still gives the child what it needs to start', async () => {
    const env = await childEnv();
    expect(env.PATH).toBe(process.env.PATH);
  });

  it('passes explicit env through', async () => {
    const env = await childEnv({ MY_SERVER_KEY: 'given-explicitly' });
    expect(env.MY_SERVER_KEY).toBe('given-explicitly');
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it('passes only the parent variables named in passEnv', async () => {
    // CUSTOM_UNLISTED is not on the default allow-list, so this proves passEnv.
    const env = await childEnv(undefined, {
      passEnv: ['CUSTOM_UNLISTED', 'GITHUB_TOKEN'],
    });
    expect(env.CUSTOM_UNLISTED).toBe('x');
    expect(env.GITHUB_TOKEN).toBe(SECRETS.GITHUB_TOKEN);
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });

  it('inheritFullEnv restores the old behaviour (and is the only way to leak)', async () => {
    const env = await childEnv(undefined, { inheritFullEnv: true });
    expect(env.ANTHROPIC_API_KEY).toBe(SECRETS.ANTHROPIC_API_KEY);
  });
});

describe('buildStdioEnv', () => {
  const parent = {
    PATH: '/bin',
    HOME: '/h',
    SECRET_KEY: 's',
    UNDEF: undefined,
  };

  it('keeps allow-listed names only and drops undefined values', () => {
    expect(buildStdioEnv(parent)).toEqual({ PATH: '/bin', HOME: '/h' });
  });

  it('lets explicit env override parent values', () => {
    expect(buildStdioEnv(parent, { PATH: '/custom' }).PATH).toBe('/custom');
  });

  it('adds passEnv names but ignores ones the parent does not have', () => {
    expect(
      buildStdioEnv(parent, {}, { passEnv: ['SECRET_KEY', 'MISSING'] }),
    ).toEqual({
      PATH: '/bin',
      HOME: '/h',
      SECRET_KEY: 's',
    });
  });

  it('matches names case-insensitively on win32 only', () => {
    const win = { Path: 'C:\\bin', SystemRoot: 'C:\\Windows', Secret: 'x' };
    expect(Object.keys(buildStdioEnv(win, {}, {}, 'win32')).sort()).toEqual([
      'Path',
      'SystemRoot',
    ]);
    expect(buildStdioEnv(win, {}, {}, 'linux')).toEqual({});
  });

  it('matches passEnv names case-insensitively on win32', () => {
    const win = { GITHUB_TOKEN: 't', Other: 'o' };
    expect(
      buildStdioEnv(win, {}, { passEnv: ['github_token'] }, 'win32'),
    ).toEqual({ GITHUB_TOKEN: 't' });
    expect(
      buildStdioEnv(win, {}, { passEnv: ['github_token'] }, 'linux'),
    ).toEqual({});
  });

  it('treats only the literal true as inheritFullEnv', () => {
    const untyped = { inheritFullEnv: 'false' } as unknown as StdioEnvOptions;
    expect(buildStdioEnv(parent, {}, untyped)).toEqual({
      PATH: '/bin',
      HOME: '/h',
    });
  });

  it('treats null options and env as absent', () => {
    const nullish = {
      passEnv: null,
      inheritFullEnv: null,
    } as unknown as StdioEnvOptions;
    expect(
      buildStdioEnv(parent, null as unknown as undefined, nullish),
    ).toEqual({ PATH: '/bin', HOME: '/h' });
    expect(
      buildStdioEnv(
        { Path: 'C:\\bin' },
        null as unknown as undefined,
        nullish,
        'win32',
      ),
    ).toEqual({ Path: 'C:\\bin' });
  });

  it('lets an explicit key replace a case-variant parent key on win32', () => {
    const win = { Path: 'C:\\bin' };
    const env = buildStdioEnv(win, { PATH: 'C:\\custom' }, {}, 'win32');
    expect(env).toEqual({ PATH: 'C:\\custom' });
  });

  it('passes the infra variables a proxied server needs by default', () => {
    const env = buildStdioEnv({
      HTTPS_PROXY: 'http://proxy',
      NODE_EXTRA_CA_CERTS: '/ca.pem',
      TMPDIR: '/tmp/x',
      ANTHROPIC_API_KEY: 'k',
    });
    expect(env).toEqual({
      HTTPS_PROXY: 'http://proxy',
      NODE_EXTRA_CA_CERTS: '/ca.pem',
      TMPDIR: '/tmp/x',
    });
  });

  it('rejects a passEnv that is not an array instead of passing characters', () => {
    expect(() =>
      buildStdioEnv(
        { HTTPS_PROXY: 'p' },
        {},
        {
          passEnv: 'HTTPS_PROXY' as unknown as string[],
        },
      ),
    ).toThrow(TypeError);
  });
});
