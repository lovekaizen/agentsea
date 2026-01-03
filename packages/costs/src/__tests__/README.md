# Costs Package Test Suite

This directory contains comprehensive unit tests for the @lov3kaizen/agentsea-costs package.

## Test Coverage

### 1. CostTracker.test.ts (45+ tests)

Tests for the `CostTracker` class which tracks individual API calls and their costs.

**Test Categories:**

- **Initialization**: Creating trackers with default and custom configs
- **Tracking**: Basic tracking, cost calculation, cache costs, timestamps, latency
- **Provider-Specific Tracking**: Anthropic and OpenAI response tracking
- **Error Tracking**: Failed request tracking
- **Buffering & Flushing**: Buffer management, auto-flush, manual flush
- **Scoped Tracking**: Creating scoped trackers with preset attribution
- **Auto-flush Timer**: Timer-based automatic flushing
- **Cleanup**: Proper resource cleanup on close

**Key Features Tested:**

- Cost calculation with multiple pricing tiers
- Attribution merging (default + call-specific)
- Real-time event emission
- Buffer size management
- Storage adapter integration
- Nested scopes for hierarchical attribution

### 2. CostManager.test.ts (40+ tests)

Tests for the `CostManager` class which provides unified API for cost management.

**Test Categories:**

- **Initialization**: Manager creation, factory function, storage initialization
- **Tracking**: All tracking methods (track, trackAnthropicResponse, trackOpenAIResponse, trackError)
- **Token Counting**: Token counting and cost estimation
- **Pricing**: Registry and calculation access
- **Queries**: Summary, dimensions, trends, records
- **Statistics**: Total cost, tokens, request count, error rate
- **Top Consumers**: Top models, users, features by cost
- **Maintenance**: Cleanup, storage stats, optimization
- **Export/Import**: Data export and import functionality
- **Events**: Event forwarding and handling

**Key Features Tested:**

- Comprehensive query API
- Storage adapter requirements
- Statistics calculations
- Batch operations
- Event system

### 3. ModelPricingRegistry.test.ts (60+ tests)

Tests for the `ModelPricingRegistry` class which manages AI model pricing information.

**Test Categories:**

- **Initialization**: Default pricing loading, custom pricing
- **Model Registration**: Adding and updating models
- **Pricing Retrieval**: Getting pricing by provider/model, partial matching
- **Cost Calculation**: Basic costs, cache costs, error handling
- **Model Listing**: Filtering by provider, sorting
- **Provider Management**: Provider listing, summaries
- **Pricing Comparison**: Comparing models, calculating savings
- **Optimization**: Finding cheapest models with filters
- **Import/Export**: Exporting and importing pricing data
- **Remote Updates**: Fetching pricing from remote URLs
- **Specific Models**: Verifying correct pricing for known models

**Key Features Tested:**

- Default pricing for 15+ models across 5+ providers
- Cache pricing (Anthropic models)
- Capability-based filtering
- Weighted price optimization
- Percentage difference calculations
- Remote data fetching with error handling

### 4. TokenCounter.test.ts (40+ tests)

Tests for the `TokenCounter` class which provides accurate token counting.

**Test Categories:**

- **Initialization**: Counter creation with custom cache size
- **Token Counting**: Basic counting, model-specific, cost estimation
- **Provider Detection**: Auto-detection from model names
- **Cost Estimation**: Text and token-based estimation, cache costs
- **Batch Operations**: Counting multiple texts
- **Message Counting**: Chat message format with overhead calculation
- **Cache Management**: Cache behavior, size limits, clearing
- **Approximation**: Handling various text types (whitespace, punctuation, unicode)
- **Standalone Functions**: countTokens and countTokensApprox utilities

**Key Features Tested:**

- Tiktoken integration (with fallback)
- Provider-specific strategies
- Character/word/token metrics
- Message format overhead
- Cache hit/miss tracking
- Unicode and special character handling

### 5. BudgetManager.test.ts (45+ tests)

Tests for the `BudgetManager` class which manages budgets and enforces limits.

**Test Categories:**

- **Initialization**: Manager creation, storage initialization
- **Budget Creation**: Basic budgets, scoped budgets, thresholds
- **Budget Updates**: Modifying limits, thresholds, enabling/disabling
- **Budget Deletion**: Removing budgets, cleanup
- **Budget Retrieval**: Getting budgets by ID, listing with filters
- **Usage Tracking**: Getting current usage, refreshing from storage
- **Budget Checking**: Pre-request validation, threshold warnings
- **Cost Recording**: Recording costs, triggering alerts
- **Period Calculations**: Daily, weekly, monthly periods
- **Scope Matching**: Global, user, project, team scopes
- **Actions**: Webhook notifications, blocking, throttling
- **Cleanup**: Proper resource cleanup

**Key Features Tested:**

- Multiple budget periods (hourly, daily, weekly, monthly, quarterly, yearly)
- Budget scopes (global, user, agent, project, team, feature)
- Warning thresholds and actions
- Budget rollover functionality
- Real-time usage projections
- Attribution-based budget matching
- Alert system with webhooks

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npx vitest run src/__tests__/CostTracker.test.ts

# Run with coverage
npx vitest run --coverage
```

## Test Statistics

- **Total Test Files**: 5
- **Total Test Cases**: 206+
- **Total Assertions**: 500+

## Testing Strategy

All tests follow these principles:

1. **Isolation**: Each test is independent with proper setup/teardown
2. **Mocking**: External dependencies (storage, network) are mocked
3. **Edge Cases**: Tests cover normal, boundary, and error conditions
4. **Type Safety**: Full TypeScript type checking in tests
5. **Async Handling**: Proper async/await usage for all promises

## Mock Patterns

### Storage Adapter Mock

```typescript
const mockStorage: CostStorageAdapter = {
  initialize: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  saveCostRecords: vi.fn().mockResolvedValue(undefined),
  // ... other methods
};
```

### Event Spy Pattern

```typescript
const eventSpy = vi.fn();
manager.on('cost:recorded', eventSpy);
// ... perform action
expect(eventSpy).toHaveBeenCalled();
```

### Fake Timer Pattern

```typescript
vi.useFakeTimers();
// ... test with timers
vi.advanceTimersByTime(1000);
vi.useRealTimers();
```

## Coverage Goals

- **Line Coverage**: 90%+
- **Branch Coverage**: 85%+
- **Function Coverage**: 95%+
- **Statement Coverage**: 90%+

## Future Test Additions

Potential areas for additional testing:

1. Integration tests with real storage adapters
2. Performance benchmarks for high-volume scenarios
3. Stress tests for concurrent operations
4. E2E tests with multiple components
5. Provider-specific integration tests

## Contributing

When adding new tests:

1. Follow existing naming conventions
2. Group related tests in describe blocks
3. Use clear, descriptive test names
4. Mock external dependencies
5. Clean up resources in afterEach/beforeEach
6. Test both success and failure paths
7. Verify error messages and types
