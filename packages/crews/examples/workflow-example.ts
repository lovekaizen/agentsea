/**
 * Workflow Example
 *
 * Demonstrates using the WorkflowBuilder for complex task orchestration.
 */

import {
  workflow,
  createDAGExecutor,
  createDAGFromSteps,
  createCheckpointManager,
  createExecutionContext,
  type StepHandler,
  type WorkflowContext,
} from '@lov3kaizen/agentsea-crews';

// Step handlers
const fetchData: StepHandler = async (context: WorkflowContext) => {
  console.log('Step: Fetching data...');

  // Simulate data fetching
  await new Promise((resolve) => setTimeout(resolve, 500));

  const data = {
    users: [
      { id: 1, name: 'Alice', score: 85 },
      { id: 2, name: 'Bob', score: 92 },
      { id: 3, name: 'Charlie', score: 78 },
    ],
  };

  context.setVariable('rawData', data);

  return {
    output: JSON.stringify(data),
    success: true,
  };
};

const validateData: StepHandler = (context: WorkflowContext) => {
  console.log('Step: Validating data...');

  const rawData = context.getVariable<{
    users: Array<{ id: number; name: string; score: number }>;
  }>('rawData');

  if (!rawData || !rawData.users || rawData.users.length === 0) {
    return Promise.resolve({
      output: 'Validation failed: No data found',
      success: false,
    });
  }

  const validUsers = rawData.users.filter(
    (u) => u.score >= 0 && u.score <= 100,
  );
  context.setVariable('validatedData', validUsers);

  return Promise.resolve({
    output: `Validated ${validUsers.length} users`,
    success: true,
  });
};

const analyzeData: StepHandler = (context: WorkflowContext) => {
  console.log('Step: Analyzing data...');

  const users =
    context.getVariable<Array<{ id: number; name: string; score: number }>>(
      'validatedData',
    ) ?? [];

  const avgScore = users.reduce((sum, u) => sum + u.score, 0) / users.length;
  const topPerformer = users.reduce((best, u) =>
    u.score > best.score ? u : best,
  );

  const analysis = {
    totalUsers: users.length,
    averageScore: avgScore.toFixed(2),
    topPerformer: topPerformer.name,
  };

  context.setVariable('analysis', analysis);

  return Promise.resolve({
    output: JSON.stringify(analysis, null, 2),
    success: true,
  });
};

const generateReport: StepHandler = (context: WorkflowContext) => {
  console.log('Step: Generating report...');

  const analysis = context.getVariable<Record<string, unknown>>('analysis');

  const report = `
# Data Analysis Report

## Summary
- Total Users: ${analysis?.totalUsers}
- Average Score: ${analysis?.averageScore}
- Top Performer: ${analysis?.topPerformer}

## Conclusion
The data analysis has been completed successfully.
`;

  return Promise.resolve({
    output: report,
    success: true,
  });
};

async function main() {
  console.log('=== Workflow Builder Example ===\n');

  // Build a workflow using the fluent API
  const workflowDef = workflow('data-processing')
    .describe('A workflow for processing and analyzing data')
    .addStep('fetch-data', fetchData)
    .addStep('validate-data', validateData)
    .when((ctx) => {
      const data = ctx.getVariable<Array<unknown>>('validatedData');
      return data && data.length > 0;
    })
    .then((b) =>
      b
        .addStep('analyze-data', analyzeData)
        .addStep('generate-report', generateReport),
    )
    .otherwise((b) =>
      b.addStep('handle-empty', () =>
        Promise.resolve({
          output: 'No data to process',
          success: true,
        }),
      ),
    )
    .endBranch()
    .checkpoint('after-processing')
    .enableCheckpoints('after-step')
    .build();

  console.log('Workflow created:', workflowDef.name);
  console.log('Steps:', workflowDef.steps.length);

  // Create execution context
  const context = createExecutionContext({
    crewName: 'workflow-test',
  });

  // Create checkpoint manager
  const _checkpoints = createCheckpointManager({
    maxCheckpoints: 5,
  });

  // Create DAG from workflow steps
  const dag = createDAGFromSteps(workflowDef.steps, workflowDef.handlers);

  // Create DAG executor
  const executor = createDAGExecutor(dag, workflowDef.handlers, {
    maxParallel: 2,
    retryOnFailure: true,
    maxRetries: 2,
  });

  // Validate the DAG
  const validation = executor.validate();
  console.log('\nDAG Validation:', validation.valid ? 'PASSED' : 'FAILED');
  if (validation.errors.length > 0) {
    console.log('Errors:', validation.errors);
  }
  if (validation.warnings.length > 0) {
    console.log('Warnings:', validation.warnings);
  }

  console.log('\n=== Executing Workflow ===\n');

  // Execute the DAG with streaming
  for await (const event of executor.executeStream(context)) {
    switch (event.type) {
      case 'dag:start':
        console.log('Workflow started');
        break;

      case 'node:start':
        console.log(`Starting: ${event.nodeName}`);
        break;

      case 'node:complete':
        console.log(`Completed: ${event.nodeName}`);
        console.log(`  Output: ${event.result?.output?.substring(0, 100)}...`);
        break;

      case 'node:error':
        console.log(`Error in ${event.nodeName}: ${event.error}`);
        break;

      case 'dag:complete':
        console.log(
          `\nWorkflow ${event.success ? 'completed successfully' : 'failed'}`,
        );
        break;
    }
  }

  // Get final statistics
  const stats = executor.getStatistics();
  console.log('\n=== Execution Statistics ===');
  console.log(`Total nodes: ${stats.totalNodes}`);
  console.log(`Completed: ${stats.completed}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Skipped: ${stats.skipped}`);
}

// Run the example
main().catch(console.error);
