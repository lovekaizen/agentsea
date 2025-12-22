/**
 * AgentSea Integration Example
 *
 * Shows how to integrate the debugger with AgentSea agents.
 */

import {
  AgentDebugger,
  DebugMiddleware,
  MemoryStorage,
  type ExecutionContext,
} from '../src/index.js';

function main() {
  console.log('🔧 AgentSea Debugger Integration Example\n');

  // ============ Using AgentDebugger (High-level API) ============
  console.log('1️⃣ Using AgentDebugger (Recommended)');
  console.log('-------------------------------------');

  // Create debugger with memory storage
  const debugger_ = new AgentDebugger({
    storage: new MemoryStorage({ maxRecordings: 100 }),
    autoSave: true,
    recordingEnabled: true,
    breakpointsEnabled: true,
  });

  // Set up event handlers
  debugger_.on('session:started', (id) =>
    console.log(`   Session started: ${id}`),
  );
  debugger_.on('step', (step) => console.log(`   Step: ${step.type}`));
  debugger_.on('recording:saved', (rec) =>
    console.log(`   Recording saved: ${rec.id}`),
  );

  // Set breakpoints
  debugger_.breakOnTool('search');
  debugger_.breakOnError();
  debugger_.breakOnDecision();

  // Create execution context
  const context: ExecutionContext = {
    agentId: 'demo-agent',
    agentName: 'Demo Agent',
    model: 'gpt-4',
    messages: [],
    tools: ['search', 'calculate', 'web-browse'],
  };

  // Start session
  debugger_.startSession(context);

  // Get middleware for step tracking
  const middleware = debugger_.getMiddleware();

  // Simulate agent execution
  middleware.onInput('What is the weather today?');
  middleware.onPrompt('You are a helpful weather assistant...');
  middleware.onToolCall({
    id: 'tool_1',
    name: 'search',
    arguments: { query: 'weather today' },
  });
  middleware.onToolResult({
    id: 'tool_1',
    name: 'search',
    result: 'Sunny, 75°F',
    success: true,
  });
  middleware.onResponse('The weather today is sunny with a high of 75°F!', {
    prompt: 150,
    completion: 30,
    total: 180,
  });

  // Create checkpoint
  debugger_.createCheckpoint('After weather query');

  // End session and get recording
  const recording = debugger_.endSession();
  console.log(`\n   Recording: ${recording?.id}`);
  console.log(`   Steps: ${recording?.steps.length}`);
  console.log('');

  // ============ Using DebugMiddleware (Low-level API) ============
  console.log('2️⃣ Using DebugMiddleware (For Custom Integration)');
  console.log('--------------------------------------------------');

  const customMiddleware = new DebugMiddleware({
    enabled: true,
    recordEnabled: true,
    autoStart: false, // Manual control
    includePrompts: true,
    includeResponses: true,
  });

  // Manual session management
  customMiddleware.startSession({
    agentId: 'custom-agent',
    agentName: 'Custom Agent',
    model: 'claude-3',
    messages: [],
    tools: ['analyze'],
  });

  // Track execution manually
  customMiddleware.onInput('Analyze this text');
  customMiddleware.onDecision({
    options: [
      { id: 'opt1', description: 'Use sentiment analysis' },
      { id: 'opt2', description: 'Use entity extraction' },
    ],
    chosen: { id: 'opt1', description: 'Use sentiment analysis' },
    confidence: 0.85,
    reason: 'User seems interested in emotional tone',
  });
  customMiddleware.onResponse('The text has a positive sentiment.');

  customMiddleware.endSession();
  console.log('   Custom middleware session completed\n');

  // ============ Creating Handler for Agent ============
  console.log('3️⃣ Creating Handler for Agent Framework');
  console.log('----------------------------------------');

  const handlerMiddleware = new DebugMiddleware();
  const _handler = handlerMiddleware.createHandler();

  console.log('   Handler methods:');
  console.log('   - beforeExecute: Called before agent execution');
  console.log('   - afterExecute: Called after agent execution');
  console.log('   - onStep: Called for each step');
  console.log('   - onError: Called on errors');
  console.log('');

  // Example usage with a hypothetical agent framework:
  /*
  const agent = new Agent({
    model: 'gpt-4',
    tools: [...],
    middleware: [handler],
  });
  */

  // ============ Analysis Features ============
  console.log('4️⃣ Analysis Features');
  console.log('---------------------');

  if (recording) {
    // Build visualizations
    const tree = debugger_.buildDecisionTree(recording);
    const graph = debugger_.buildFlowGraph(recording);

    console.log(`   Decision Tree: ${tree.nodes.length} nodes`);
    console.log(
      `   Flow Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`,
    );

    // If recording had failed, we could analyze it
    if (recording.status === 'failed') {
      const analysis = debugger_.analyzeFailure(recording);
      console.log(`   Root Cause: ${analysis.rootCause}`);
      console.log(`   Recommendations: ${analysis.recommendations.length}`);
    }
  }

  console.log('');

  // ============ Replay Features ============
  console.log('5️⃣ Replay Features');
  console.log('-------------------');

  if (recording) {
    const replayEngine = debugger_.getReplayEngine();

    replayEngine.on('replay:started', (session) => {
      console.log(`   Replay started: ${session.id}`);
    });

    replayEngine.on('step:replayed', (step) => {
      console.log(`   Replayed step ${step.index}: ${step.type}`);
    });

    // Start replay with modifications
    const session = debugger_.replay(recording, {
      speed: 'instant',
      modifications: [
        {
          stepIndex: 2, // Modify the tool call
          type: 'modify',
          data: {
            toolCall: {
              id: 'tool_1',
              name: 'search',
              arguments: { query: 'weather forecast' },
            },
          },
        },
      ],
    });

    console.log(`   Replay session: ${session.id}`);
  }

  console.log('\n✅ Example completed!');
}

main();
