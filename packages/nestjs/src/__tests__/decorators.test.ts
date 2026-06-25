import { Reflector } from '@nestjs/core';
import { describe, it, expect } from 'vitest';

import { Agent, AGENT_METADATA } from '../decorators/agent.decorator';
import { Tool, TOOL_METADATA } from '../decorators/tool.decorator';

describe('@Agent decorator', () => {
  it('attaches agent config metadata to the class', () => {
    const config = { name: 'support-bot', description: 'Helps users' };

    @Agent(config)
    class SupportAgent {}

    const reflector = new Reflector();
    const metadata = reflector.get(AGENT_METADATA, SupportAgent);
    expect(metadata).toEqual(config);
  });

  it('returns the original class (does not replace it)', () => {
    class Base {
      hello() {
        return 'hi';
      }
    }
    const Decorated = Agent({ name: 'x' })(Base as any);
    expect(Decorated).toBe(Base);
    expect(new Base().hello()).toBe('hi');
  });

  it('uses a stable metadata key', () => {
    expect(AGENT_METADATA).toBe('agentsea:agent');
  });
});

describe('@Tool decorator', () => {
  it('attaches tool options metadata to the method', () => {
    const opts = { name: 'search', description: 'Search the web' };

    class Toolbox {
      @Tool(opts)
      search() {
        return 'result';
      }
    }

    const reflector = new Reflector();
    const metadata = reflector.get(
      TOOL_METADATA,
      Object.getOwnPropertyDescriptor(Toolbox.prototype, 'search')!.value,
    );
    expect(metadata).toEqual(opts);
  });

  it('preserves the original method implementation', () => {
    class Toolbox {
      @Tool({ name: 'echo', description: 'echoes' })
      echo(value: string) {
        return value;
      }
    }
    expect(new Toolbox().echo('hello')).toBe('hello');
  });

  it('uses a stable metadata key', () => {
    expect(TOOL_METADATA).toBe('agentsea:tool');
  });
});
