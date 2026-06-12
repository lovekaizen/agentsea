/**
 * Research Team Example
 *
 * Demonstrates using the pre-built ResearchCrew template.
 */

import {
  createResearchCrew,
  ResearchTasks,
  createDashboard,
} from '@lov3kaizen/agentsea-crews';

async function main() {
  // Create a research crew using the template
  const crew = createResearchCrew({
    name: 'market-research-crew',
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    depth: 'deep',
    includeWriter: true,
  });

  // Create a dashboard for monitoring
  const dashboard = createDashboard(crew, {
    updateInterval: 1000,
    trackEvents: true,
  });

  // Subscribe to dashboard updates
  const unsubscribe = dashboard.subscribe((update) => {
    if (update.type === 'metrics_update') {
      const progress = dashboard.getProgress();
      console.log(`Progress: ${progress.percentage.toFixed(1)}%`);
    }
  });

  // Add research tasks using templates
  crew.addTask(
    ResearchTasks.research('electric vehicle market in 2025', 'deep'),
  );
  crew.addTask(
    ResearchTasks.analyze('Market data and trends', [
      'market size',
      'growth rate',
      'key players',
    ]),
  );
  crew.addTask(
    ResearchTasks.writeReport('Electric Vehicle Market Analysis', 'executive'),
  );

  console.log('Starting research crew...\n');

  try {
    // Run the crew
    const result = await crew.kickoff({
      input: 'Research the electric vehicle market for 2025',
      context: {
        industry: 'automotive',
        region: 'global',
      },
    });

    console.log('\n=== Research Complete ===');
    console.log(`Success: ${result.success}`);
    console.log(`Tasks completed: ${result.metrics.completedTasks}`);
    console.log(`Total time: ${result.metrics.totalExecutionTimeMs}ms`);
    console.log(`Total tokens: ${result.metrics.totalTokens}`);

    console.log('\n=== Final Output ===');
    console.log(result.finalOutput);

    // Get final dashboard snapshot
    const snapshot = dashboard.getSnapshot();
    console.log('\n=== Agent Performance ===');
    for (const [name, agent] of Object.entries(snapshot.agents)) {
      console.log(`${name}: ${agent.tasksCompleted} tasks completed`);
    }
  } finally {
    // Cleanup
    unsubscribe();
    dashboard.stop();
  }
}

// Run the example
main().catch(console.error);
