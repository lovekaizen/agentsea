# @lov3kaizen/agentsea-debugger

AI Agent debugger with step-through execution, decision tree visualization, checkpoint replay, and what-if scenario testing.

## Features

- **Step-through Debugging**: Pause execution at breakpoints and step through agent actions
- **Execution Recording**: Record complete agent sessions for later analysis
- **Checkpoint System**: Create and restore checkpoints at any point in execution
- **Replay Engine**: Replay recordings with modifications to explore alternatives
- **Failure Analysis**: Automatic root cause analysis with recommendations
- **What-If Scenarios**: Test alternative paths without re-running the agent
- **Decision Tree Visualization**: Visualize agent decision points as trees
- **Flow Graph Visualization**: See execution flow as a graph
- **Storage Adapters**: File-based and in-memory storage options

## Installation

```bash
pnpm add @lov3kaizen/agentsea-debugger
```

## Quick Start

```typescript
import {
  Debugger,
  BreakpointHelpers,
} from '@lov3kaizen/agentsea-debugger';

// Create debugger
const debugger = new Debugger();

// Attach to agent
debugger.attach(agent);

// Set breakpoints
debugger.setBreakpoint(BreakpointHelpers.onTool('search'));
debugger.setBreakpoint(BreakpointHelpers.onError());

// Start session
const session = await debugger.startSession();

// Execute agent...
await agent.execute('Hello');

// Get recording
const recording = await debugger.endSession();
```

## Core Concepts

### Debugger

The main entry point for debugging agents:

```typescript
import { Debugger } from '@lov3kaizen/agentsea-debugger';

const debugger = new Debugger({
  maxSteps: 1000,
  recording: {
    enabled: true,
    includePrompts: true,
    includeResponses: true,
  },
});

// Attach to agent
debugger.attach({
  id: 'my-agent',
  name: 'My Agent',
  model: 'gpt-5.5',
});

// Start debugging
const session = await debugger.startSession();
```

### Breakpoints

Set breakpoints to pause execution at specific points:

```typescript
import { BreakpointHelpers } from '@lov3kaizen/agentsea-debugger';

// Break on specific tool
debugger.setBreakpoint(BreakpointHelpers.onTool('search'));

// Break on any error
debugger.setBreakpoint(BreakpointHelpers.onError());

// Break on decisions
debugger.setBreakpoint(BreakpointHelpers.onDecision());

// Break on low confidence
debugger.setBreakpoint(BreakpointHelpers.onLowConfidence(0.5));

// Custom breakpoint
debugger.setBreakpoint(BreakpointHelpers.custom(
  (ctx) => ctx.step.type === 'tool-call' && ctx.step.toolCall?.name === 'delete',
  'Break on delete operations'
));
```

### Recording

Record agent execution for later analysis:

```typescript
import { Recorder } from '@lov3kaizen/agentsea-debugger';

const recorder = new Recorder({
  includePrompts: true,
  includeResponses: true,
  autoSnapshot: true,
  snapshotInterval: 10,
});

// Start recording
recorder.start('my-agent', initialState);

// Record steps
recorder.recordStep(step, state);

// Create checkpoint
recorder.createCheckpoint('Before API call');

// Stop and get recording
const recording = recorder.stop();
```

### Replay

Replay recordings with modifications:

```typescript
import { ReplayEngine } from '@lov3kaizen/agentsea-debugger';

const replay = new ReplayEngine();

// Start replay
const session = await replay.start(recording, {
  speed: 'normal',
  modifications: [
    { stepIndex: 5, type: 'modify', data: { output: 'alternative result' } },
  ],
});

// Listen to events
replay.on('step:replayed', (step, state) => {
  console.log(`Replayed step ${step.index}`);
});

// Control playback
replay.pause();
replay.resume();
replay.setSpeed('fast');
```

### Failure Analysis

Automatically analyze failed executions:

```typescript
import { FailureAnalyzer } from '@lov3kaizen/agentsea-debugger';

const analyzer = new FailureAnalyzer();

// Analyze a failed recording
const analysis = analyzer.analyze(recording);

console.log('Root Cause:', analysis.rootCause);
console.log('Severity:', analysis.severity);
console.log('Recommendations:', analysis.recommendations);
```

### What-If Scenarios

Explore alternative execution paths:

```typescript
import { WhatIfEngine } from '@lov3kaizen/agentsea-debugger';

const whatIf = new WhatIfEngine();

// Create scenario
const scenario = whatIf.createScenario({
  name: 'What if search succeeded?',
  recordingId: recording.id,
  modifications: [
    {
      stepIndex: 3,
      type: 'modify',
      data: {
        toolCall: {
          id: 'tool_1',
          name: 'search',
          result: 'Success!',
          success: true,
        },
      },
    },
  ],
});

// Run scenario
const result = await whatIf.runScenario(scenario.id, recording);

// Compare with original
const comparison = whatIf.compare(recording, result);
```

### Visualization

Generate decision trees and flow graphs:

```typescript
import {
  DecisionTreeBuilder,
  FlowGraphBuilder,
} from '@lov3kaizen/agentsea-debugger';

// Build decision tree
const treeBuilder = new DecisionTreeBuilder();
const tree = treeBuilder.build(recording);

// Export as Mermaid
console.log(treeBuilder.toMermaid());

// Build flow graph
const graphBuilder = new FlowGraphBuilder();
const graph = graphBuilder.build(recording);

// Export as DOT (Graphviz)
console.log(graphBuilder.toDOT());
```

### Storage

Store and retrieve recordings:

```typescript
import { FileStorage, MemoryStorage } from '@lov3kaizen/agentsea-debugger';

// File-based storage
const fileStorage = new FileStorage({
  basePath: './debug-sessions',
  fs: nodeFs, // Node.js fs/promises wrapper
});

// In-memory storage
const memoryStorage = new MemoryStorage({
  maxRecordings: 100,
  maxSizeBytes: 50 * 1024 * 1024, // 50MB
});

// Save recording
await storage.save(recording);

// Load recording
const loaded = await storage.load(recording.id);

// List recordings
const recordings = await storage.list();
```

## AgentSea Integration

Use the high-level `AgentDebugger` for seamless integration:

```typescript
import { AgentDebugger, MemoryStorage } from '@lov3kaizen/agentsea-debugger';

const debugger = new AgentDebugger({
  storage: new MemoryStorage(),
  autoSave: true,
});

// Set breakpoints
debugger.breakOnTool('search');
debugger.breakOnError();

// Start session
await debugger.startSession({
  agentId: 'my-agent',
  agentName: 'My Agent',
  model: 'gpt-5.5',
  messages: [],
  tools: ['search'],
});

// Get middleware for step tracking
const middleware = debugger.getMiddleware();

// Track steps
middleware.onInput('User question');
middleware.onToolCall({ name: 'search', arguments: { query: 'test' } });
middleware.onToolResult({ id: 'tool_1', name: 'search', result: 'Found!', success: true });
middleware.onResponse('Here is the answer');

// End session
const recording = await debugger.endSession();

// Analyze if failed
if (recording.status === 'failed') {
  const analysis = debugger.analyzeFailure(recording);
  console.log(analysis.recommendations);
}
```

## API Reference

### Core

- `Debugger` - Main debugger class
- `DebugSessionManager` - Session management
- `BreakpointManager` - Breakpoint management
- `Inspector` - State inspection

### Recording

- `Recorder` - Execution recording
- `SnapshotManager` - State snapshots
- `CheckpointManager` - Checkpoint management
- `Timeline` - Event timeline

### Replay

- `ReplayEngine` - Replay execution
- `ReplayController` - Playback control
- `StateRestorer` - State restoration

### Visualization

- `DecisionTreeBuilder` - Decision tree generation
- `FlowGraphBuilder` - Flow graph generation

### Analysis

- `FailureAnalyzer` - Failure root cause analysis
- `WhatIfEngine` - What-if scenario testing

### Storage

- `FileStorage` - File-based storage
- `MemoryStorage` - In-memory storage

### Integration

- `AgentDebugger` - High-level debugger wrapper
- `DebugMiddleware` - Middleware for agents

## Examples

See the `examples/` directory for complete examples:

- `basic-debugging.ts` - Core debugging functionality
- `replay-and-analysis.ts` - Replay and failure analysis
- `agentsea-integration.ts` - AgentSea integration

## License

MIT
