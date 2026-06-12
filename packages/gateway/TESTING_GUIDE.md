# Gateway Testing Guide

Quick reference for testing patterns and best practices used in the gateway package.

## Table of Contents

- [Running Tests](#running-tests)
- [Test File Organization](#test-file-organization)
- [Common Patterns](#common-patterns)
- [Mocking Strategies](#mocking-strategies)
- [Assertions](#assertions)
- [Examples](#examples)

---

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Watch mode for development
npm run test:watch

# Run specific test file
npm test -- provider-health.test.ts

# Run tests matching a pattern
npm test -- --grep "CircuitBreaker"
```

---

## Test File Organization

### File Structure

```
src/
├── __tests__/
│   ├── provider-health.test.ts
│   ├── cost-optimized-strategy.test.ts
│   ├── metrics.test.ts
│   └── ...
├── providers/
│   └── ProviderHealth.ts
└── routing/
    └── strategies/
        └── CostOptimized.ts
```

### Test File Template

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClassToTest } from '../path/to/source.js';

describe('ClassToTest', () => {
  let instance: ClassToTest;

  beforeEach(() => {
    instance = new ClassToTest();
  });

  afterEach(() => {
    // Cleanup
  });

  describe('methodName', () => {
    it('should do expected behavior', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = instance.methodName(input);

      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

---

## Common Patterns

### 1. Mock Provider Pattern

Used for testing routing strategies and gateway functionality.

```typescript
class MockProvider extends Provider {
  constructor(
    name: string,
    models: string[] = ['model-1'],
    options: { inputPrice?: number; outputPrice?: number } = {},
  ) {
    const config: ProviderConfig = {
      name,
      models,
      apiKey: 'test-key',
    };
    super(config);
    this.inputPrice = options.inputPrice ?? 1.0;
    this.outputPrice = options.outputPrice ?? 2.0;
  }

  async chat(): Promise<any> {
    return {
      id: 'test',
      object: 'chat.completion',
      created: Date.now(),
      model: this.config.models[0],
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'test' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };
  }

  // Implement other required methods...
}
```

### 2. Event Emission Testing

Used for testing health monitors and event-driven components.

```typescript
it('should emit event when condition met', () => {
  const handler = vi.fn();
  monitor.on('event-name', handler);

  // Trigger the event
  monitor.doSomethingThatEmitsEvent();

  expect(handler).toHaveBeenCalledTimes(1);
  expect(handler).toHaveBeenCalledWith(
    expect.objectContaining({
      property: 'expected-value',
    }),
  );
});
```

### 3. Time-Based Testing

Used for testing timeouts, intervals, and circuit breakers.

```typescript
it('should transition after timeout', () => {
  vi.useFakeTimers();

  // Trigger action that involves time
  breaker.recordFailure();
  breaker.recordFailure();
  breaker.recordFailure(); // Circuit opens

  expect(breaker.isAllowed()).toBe(false);

  // Advance time
  vi.advanceTimersByTime(config.timeout + 1);

  expect(breaker.isAllowed()).toBe(true); // Circuit half-open

  vi.useRealTimers();
});
```

### 4. HTTP Endpoint Testing

Used for testing REST API endpoints.

```typescript
it('should handle POST request', async () => {
  const app = createHTTPServer({ gateway: mockGateway });

  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-5.5',
      messages: [{ role: 'user', content: 'Hello' }],
    }),
  });

  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data).toHaveProperty('choices');
});
```

### 5. Statistical/Aggregation Testing

Used for testing metrics and analytics.

```typescript
it('should calculate percentiles correctly', () => {
  // Record many observations
  for (let i = 0; i < 100; i++) {
    metrics.recordHistogram('latency', i);
  }

  const summary = metrics.getSummary();

  expect(summary.latency.p50).toBeGreaterThanOrEqual(40);
  expect(summary.latency.p50).toBeLessThanOrEqual(60);
  expect(summary.latency.p95).toBeGreaterThan(90);
});
```

---

## Mocking Strategies

### Mock Functions

```typescript
const mockFn = vi.fn();
mockFn.mockReturnValue('value');
mockFn.mockResolvedValue(Promise.resolve('async value'));
mockFn.mockRejectedValue(new Error('error'));

// Verify calls
expect(mockFn).toHaveBeenCalledTimes(2);
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
expect(mockFn).toHaveBeenLastCalledWith('arg');
```

### Mock Modules

```typescript
vi.mock('../module.js', () => ({
  ExportedClass: vi.fn().mockImplementation(() => ({
    method: vi.fn().mockReturnValue('mocked'),
  })),
}));
```

### Mock Gateway

```typescript
const createMockGateway = () => {
  const mockChat = vi.fn().mockResolvedValue({
    id: 'test-123',
    choices: [{ index: 0, message: { content: 'Hello!' } }],
  });

  return {
    chat: {
      completions: {
        create: mockChat,
      },
    },
    checkHealth: vi.fn().mockResolvedValue({ provider: true }),
    getMetrics: vi.fn().mockReturnValue({ requests: { total: 0 } }),
  } as unknown as Gateway;
};
```

---

## Assertions

### Common Expectations

```typescript
// Equality
expect(value).toBe(expected);
expect(value).toEqual(expected); // Deep equality
expect(value).not.toBe(unexpected);

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Numbers
expect(number).toBeGreaterThan(5);
expect(number).toBeGreaterThanOrEqual(5);
expect(number).toBeLessThan(10);
expect(number).toBeLessThanOrEqual(10);
expect(number).toBeCloseTo(5.5, 1); // Within precision

// Strings
expect(string).toContain('substring');
expect(string).toMatch(/regex/);

// Arrays
expect(array).toHaveLength(3);
expect(array).toContain(item);

// Objects
expect(object).toHaveProperty('key');
expect(object).toHaveProperty('key', 'value');
expect(object).toMatchObject({ subset: 'of properties' });

// Functions
expect(fn).toThrow();
expect(fn).toThrow(Error);
expect(fn).toThrow('error message');

// Async
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow(Error);
```

---

## Examples

### Testing a Strategy

```typescript
describe('CostOptimizedStrategy', () => {
  let strategy: CostOptimizedStrategy;
  let registry: ProviderRegistry;

  beforeEach(() => {
    strategy = new CostOptimizedStrategy();
    registry = new ProviderRegistry();
  });

  it('should route to cheapest provider', () => {
    // Arrange
    registry.register(
      new MockProvider('expensive', ['model-a'], {
        inputPrice: 10,
        outputPrice: 20,
      }),
    );
    registry.register(
      new MockProvider('cheap', ['model-b'], {
        inputPrice: 0.1,
        outputPrice: 0.2,
      }),
    );

    const request: ChatCompletionRequest = {
      model: 'best',
      messages: [{ role: 'user', content: 'Hello' }],
    };

    // Act
    const decision = strategy.route(request, registry);

    // Assert
    expect(decision.provider).toBe('cheap');
    expect(decision.model).toBe('model-b');
  });
});
```

### Testing Metrics Collection

```typescript
describe('MetricsCollector', () => {
  let metrics: MetricsCollector;

  beforeEach(() => {
    metrics = new MetricsCollector();
  });

  it('should track request metrics', () => {
    // Arrange
    const requestData = {
      provider: 'openai',
      model: 'gpt-5.5',
      status: 'success' as const,
      latencyMs: 150,
      inputTokens: 100,
      outputTokens: 50,
      cost: 0.001,
      cached: false,
    };

    // Act
    metrics.recordRequest(requestData);
    const summary = metrics.getSummary();

    // Assert
    expect(summary.requests.total).toBe(1);
    expect(summary.requests.successful).toBe(1);
    expect(summary.tokens.total).toBe(150);
    expect(summary.cost.total).toBe(0.001);
  });
});
```

### Testing Circuit Breaker

```typescript
describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
    });
  });

  it('should trip after threshold failures', () => {
    // Record failures
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe('closed');

    breaker.recordFailure();
    expect(breaker.getState()).toBe('open');
    expect(breaker.isAllowed()).toBe(false);
  });
});
```

### Testing Error Handling

```typescript
it('should handle validation errors', async () => {
  // Arrange
  mockGateway.chat.completions.create = vi.fn().mockRejectedValue(
    Object.assign(new Error('Invalid request'), {
      name: 'ValidationError',
      code: 'invalid_request',
    }),
  );

  const app = createHTTPServer({ gateway: mockGateway });

  // Act
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ model: 'gpt-5.5', messages: [] }),
  });

  // Assert
  expect(res.status).toBe(400);
  const data = await res.json();
  expect(data.error.type).toBe('invalid_request_error');
});
```

---

## Best Practices

### ✅ Do's

1. **Use descriptive test names**

   ```typescript
   it('should route to cheapest provider when quality threshold is met');
   ```

2. **Follow AAA pattern** (Arrange, Act, Assert)

   ```typescript
   it('should increment counter', () => {
     // Arrange
     const metrics = new MetricsCollector();

     // Act
     metrics.incrementCounter('test', 5);

     // Assert
     expect(metrics.getCounter('test')).toBe(5);
   });
   ```

3. **Test one thing per test**
4. **Use beforeEach for common setup**
5. **Clean up after tests** (afterEach, vi.useRealTimers)
6. **Mock external dependencies**
7. **Test edge cases** (empty arrays, null values, zero, negative numbers)
8. **Test error conditions**

### ❌ Don'ts

1. **Don't test implementation details** - test behavior
2. **Don't share state between tests**
3. **Don't use real API calls** - mock them
4. **Don't write overly complex tests** - simplify when possible
5. **Don't ignore flaky tests** - fix them
6. **Don't test framework code** - trust vitest, focus on your code

---

## Coverage Goals

Target coverage levels:

- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

Run coverage report:

```bash
npm run test:coverage
```

---

## Debugging Tests

### Run single test

```typescript
it.only('should focus on this test', () => {
  // This test will run alone
});
```

### Skip test temporarily

```typescript
it.skip('should skip this test', () => {
  // This test won't run
});
```

### Debug output

```typescript
it('should debug', () => {
  console.log('Debug output:', value);
  expect(value).toBeDefined();
});
```

### Use VS Code debugger

1. Set breakpoint in test file
2. Run "Debug Test" from command palette
3. Step through code

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Test Coverage Report](./TEST_COVERAGE_REPORT.md)

---

**Last Updated**: 2025-12-22
