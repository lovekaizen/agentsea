/**
 * Replay and Analysis Example
 *
 * Demonstrates replaying recordings and analyzing failures.
 */

import {
  ReplayEngine,
  FailureAnalyzer,
  WhatIfEngine,
  DecisionTreeBuilder,
  FlowGraphBuilder,
  type Recording,
  type AgentState,
} from '../src/index.js';

// Helper to create mock state
function createState(): AgentState {
  return {
    agentId: 'demo-agent',
    agentName: 'Demo Agent',
    model: 'gpt-5.5',
    memory: { size: 0 },
    context: {},
    tools: ['search', 'calculate'],
    messages: [],
  };
}

// Helper to create a mock recording
function createMockRecording(): Recording {
  const state = createState();

  return {
    id: 'rec_demo_001',
    agentId: 'demo-agent',
    agentName: 'Demo Agent',
    status: 'failed',
    startedAt: Date.now() - 5000,
    endedAt: Date.now(),
    durationMs: 5000,
    steps: [
      {
        id: 'step_0',
        index: 0,
        type: 'input',
        timestamp: Date.now() - 5000,
        durationMs: 100,
        input: 'Find the latest news about AI',
      },
      {
        id: 'step_1',
        index: 1,
        type: 'prompt',
        timestamp: Date.now() - 4900,
        durationMs: 50,
        input: 'System prompt...',
      },
      {
        id: 'step_2',
        index: 2,
        type: 'tool-call',
        timestamp: Date.now() - 4850,
        durationMs: 1000,
        toolCall: {
          id: 'tool_1',
          name: 'search',
          arguments: { query: 'AI news' },
        },
      },
      {
        id: 'step_3',
        index: 3,
        type: 'tool-result',
        timestamp: Date.now() - 3850,
        durationMs: 100,
        toolCall: {
          id: 'tool_1',
          name: 'search',
          arguments: { query: 'AI news' },
          result: 'Error: API rate limit exceeded',
          success: false,
        },
      },
      {
        id: 'step_4',
        index: 4,
        type: 'tool-call',
        timestamp: Date.now() - 3750,
        durationMs: 1000,
        toolCall: {
          id: 'tool_2',
          name: 'search',
          arguments: { query: 'AI news' },
        },
      },
      {
        id: 'step_5',
        index: 5,
        type: 'tool-result',
        timestamp: Date.now() - 2750,
        durationMs: 100,
        toolCall: {
          id: 'tool_2',
          name: 'search',
          arguments: { query: 'AI news' },
          result: 'Error: API rate limit exceeded',
          success: false,
        },
      },
      {
        id: 'step_6',
        index: 6,
        type: 'error',
        timestamp: Date.now() - 2650,
        durationMs: 0,
        error: {
          name: 'APIError',
          message: 'Search API rate limit exceeded after 2 retries',
        },
      },
    ],
    toolCalls: [
      {
        id: 'tool_1',
        name: 'search',
        arguments: { query: 'AI news' },
        success: false,
      },
      {
        id: 'tool_2',
        name: 'search',
        arguments: { query: 'AI news' },
        success: false,
      },
    ],
    decisions: [],
    checkpoints: [],
    initialState: state,
    finalState: state,
    tokenUsage: { prompt: 200, completion: 0, total: 200 },
    version: '1.0.0',
  };
}

async function main() {
  const recording = createMockRecording();

  console.log('📼 Original Recording');
  console.log(`   ID: ${recording.id}`);
  console.log(`   Status: ${recording.status}`);
  console.log(`   Steps: ${recording.steps.length}`);
  console.log('');

  // ============ Failure Analysis ============
  console.log('🔍 Failure Analysis');
  console.log('-------------------');

  const analyzer = new FailureAnalyzer();
  const analysis = analyzer.analyze(recording);

  console.log(`Root Cause: ${analysis.rootCause}`);
  console.log(`Severity: ${analysis.severity}`);
  console.log(`Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
  console.log('');

  console.log('Contributing Factors:');
  for (const factor of analysis.contributingFactors) {
    console.log(`  - [${factor.severity}] ${factor.description}`);
  }
  console.log('');

  console.log('Recommendations:');
  for (const rec of analysis.recommendations) {
    console.log(`  ${rec.priority}. ${rec.title}`);
  }
  console.log('');

  // ============ What-If Scenarios ============
  console.log('🤔 What-If Scenarios');
  console.log('--------------------');

  const whatIf = new WhatIfEngine();

  // Create a scenario where the first search succeeds
  const scenario = whatIf.createScenario({
    name: 'First search succeeds',
    recordingId: recording.id,
    modifications: [
      {
        stepIndex: 3,
        type: 'modify',
        data: {
          toolCall: {
            id: 'tool_1',
            name: 'search',
            arguments: { query: 'AI news' },
            result: 'Latest AI news from various sources...',
            success: true,
          },
        },
      },
    ],
  });

  console.log(`Created scenario: ${scenario.name}`);
  console.log(`Modifications: ${scenario.modifications.length}`);
  console.log('');

  // ============ Visualization ============
  console.log('📊 Visualization');
  console.log('----------------');

  // Build decision tree
  const treeBuilder = new DecisionTreeBuilder();
  const tree = treeBuilder.build(recording);

  console.log('Decision Tree:');
  console.log(`  Nodes: ${tree.nodes.length}`);
  console.log(`  Depth: ${String(tree.metadata?.depth)}`);
  console.log('');

  // Export as Mermaid
  console.log('Mermaid Diagram:');
  console.log(treeBuilder.toMermaid());
  console.log('');

  // Build flow graph
  const graphBuilder = new FlowGraphBuilder();
  const graph = graphBuilder.build(recording);

  console.log('Flow Graph:');
  console.log(`  Nodes: ${graph.nodes.length}`);
  console.log(`  Edges: ${graph.edges.length}`);
  console.log('');

  console.log('Mermaid Flowchart:');
  console.log(graphBuilder.toMermaid());
  console.log('');

  // ============ Replay ============
  console.log('🔄 Replay');
  console.log('---------');

  const replay = new ReplayEngine({
    trackDifferences: true,
    pauseOnErrors: false,
  });

  replay.on('step:replayed', (step, _state) => {
    console.log(`  Replayed step ${step.index}: ${step.type}`);
  });

  replay.on('replay:completed', (result) => {
    console.log(`\nReplay completed:`);
    console.log(`  Steps replayed: ${result.stepsReplayed}`);
    console.log(`  Duration: ${result.durationMs}ms`);
  });

  const session = replay.start(recording, {
    speed: 'instant',
  });

  console.log(`Started replay: ${session.id}`);

  // Wait a bit for replay to complete
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

main().catch(console.error);
