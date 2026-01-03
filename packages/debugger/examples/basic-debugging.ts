/**
 * Basic Debugging Example
 *
 * Demonstrates the core debugging functionality of the debugger package.
 */

import { Debugger, BreakpointHelpers, type AgentState } from '../src/index.js';

function main() {
  // Create debugger instance
  const debugger_ = new Debugger({
    maxSteps: 1000,
    recording: {
      enabled: true,
      includePrompts: true,
      includeResponses: true,
    },
  });

  // Define a mock agent
  const agent = {
    id: 'demo-agent',
    name: 'Demo Agent',
    model: 'gpt-4',
  };

  // Attach debugger to agent
  debugger_.attach(agent);

  // Set up event handlers
  debugger_.on('session:started', (sessionId) => {
    console.log(`🔍 Debug session started: ${sessionId}`);
  });

  debugger_.on('step', (step) => {
    console.log(`  📌 Step ${step.index}: ${step.type}`);
  });

  debugger_.on('breakpoint:hit', (breakpoint, step) => {
    console.log(
      `  🛑 Breakpoint hit at step ${step.index}: ${breakpoint.description}`,
    );
  });

  debugger_.on('session:ended', (sessionId, recording) => {
    console.log(`✅ Session ended: ${sessionId}`);
    console.log(`   Total steps: ${recording.steps.length}`);
    console.log(`   Duration: ${recording.durationMs}ms`);
  });

  // Set breakpoints
  debugger_.setBreakpoint(BreakpointHelpers.onTool('search'));
  debugger_.setBreakpoint(BreakpointHelpers.onError());

  // Start a debug session
  const session = debugger_.startSession({ agentId: agent.id });
  console.log(`Session ID: ${session.id}`);

  // Get step builder for creating steps
  const steps = debugger_.steps();

  // Simulate agent execution
  const mockState: AgentState = {
    agentId: agent.id,
    agentName: agent.name,
    model: agent.model,
    memory: { size: 0 },
    context: {},
    tools: ['search', 'calculate'],
    messages: [],
  };

  // Record user input
  debugger_.recordStep(
    steps.input('What is the weather in New York?'),
    mockState,
  );

  // Record prompt
  debugger_.recordStep(
    steps.prompt('You are a helpful assistant...'),
    mockState,
  );

  // Record tool call (this should trigger the breakpoint)
  debugger_.recordStep(
    steps.toolCall({
      id: 'tool_1',
      name: 'search',
      arguments: { query: 'weather New York' },
    }),
    mockState,
  );

  // Record tool result
  debugger_.recordStep(
    steps.toolResult(
      {
        id: 'tool_1',
        name: 'search',
        arguments: { query: 'weather New York' },
        result: 'Sunny, 72°F',
        success: true,
      },
      true,
    ),
    mockState,
  );

  // Record response
  debugger_.recordStep(
    steps.response(
      'The current weather in New York is sunny with a temperature of 72°F.',
      {
        prompt: 100,
        completion: 50,
        total: 150,
      },
    ),
    mockState,
  );

  // Create a checkpoint
  debugger_.createCheckpoint({
    name: 'After weather query',
    description: 'State after completing weather query',
  });

  // Inspect current state
  const inspector = debugger_.inspect();
  if (inspector) {
    console.log('\n📊 Inspection Results:');
    const result = inspector.inspect();
    console.log(`   Current step: ${result.stepIndex}`);
    console.log(`   Total steps: ${result.totalSteps}`);
    console.log(`   Tool calls: ${result.toolCalls.length}`);
  }

  // End the session
  const recording = debugger_.endSession();

  if (recording) {
    console.log('\n📼 Recording Summary:');
    console.log(`   ID: ${recording.id}`);
    console.log(`   Status: ${recording.status}`);
    console.log(`   Steps: ${recording.steps.length}`);
    console.log(`   Tool Calls: ${recording.toolCalls.length}`);
    console.log(`   Checkpoints: ${recording.checkpoints.length}`);
    console.log(`   Token Usage: ${recording.tokenUsage.total} tokens`);
  }
}

main();
