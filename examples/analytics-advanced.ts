/**
 * Analytics Advanced Example
 *
 * Demonstrates advanced analytics features including:
 * - Flow analysis
 * - Drop-off detection
 * - Trend analysis
 * - Anomaly detection
 * - Custom metrics
 */

import {
  Analytics,
  MemoryStorageAdapter,
  FlowAnalyzer,
  DropOffDetector,
  SuccessAnalyzer,
  TrendAnalyzer,
  AnomalyDetector,
  MetricsEngine,
  CustomMetrics,
  KPITracker,
  Aggregations,
  type Conversation,
} from '@lov3kaizen/agentsea-analytics';

// Helper to create sample conversations
async function createSampleConversations(
  analytics: Analytics,
  count: number,
): Promise<void> {
  const statuses = ['completed', 'abandoned', 'escalated'];
  const topics = ['billing', 'account', 'technical', 'general'];

  for (let i = 0; i < count; i++) {
    const conv = await analytics.startConversation({
      userId: `user-${i % 10}`,
      sessionId: `session-${Math.floor(i / 5)}`,
      metadata: {
        channel: i % 2 === 0 ? 'web' : 'mobile',
        topic: topics[i % topics.length],
      },
    });

    // Add messages
    const messageCount = Math.floor(Math.random() * 8) + 2;
    for (let j = 0; j < messageCount; j++) {
      await analytics.addMessage(conv.id, {
        role: j % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${j + 1} in conversation ${i + 1}`,
        conversationId: conv.id,
        tokenUsage: { input: 10, output: 20, total: 30 },
        latencyMs: Math.random() * 500 + 100,
      });
    }

    // End with random outcome
    const status = statuses[Math.floor(Math.random() * 3)];
    await analytics.endConversation(conv.id, {
      success: status === 'completed',
      satisfaction:
        status === 'completed'
          ? Math.floor(Math.random() * 2) + 4
          : Math.floor(Math.random() * 3) + 1,
      escalated: status === 'escalated',
    });
  }
}

async function main() {
  console.log('Analytics Advanced Example\n');
  console.log('='.repeat(60));

  // Setup
  const storage = new MemoryStorageAdapter();
  const analytics = new Analytics({ enabled: true, storage });
  await analytics.initialize();

  // Create sample data
  console.log('\n1. Creating sample conversations...');
  await createSampleConversations(analytics, 50);
  console.log('   Created 50 sample conversations\n');

  // =================================================================
  // 2. Flow Analysis
  // =================================================================
  console.log('2. Flow Analysis');
  console.log('-'.repeat(40));

  const flowAnalyzer = new FlowAnalyzer(storage);
  const flowResult = await flowAnalyzer.analyze({
    minSupport: 0.1,
  });

  console.log(`   Total flows analyzed: ${flowResult.totalFlows}`);
  console.log(`   Unique paths: ${flowResult.uniquePaths}`);
  console.log('   Top patterns:');
  for (const pattern of flowResult.patterns.slice(0, 3)) {
    console.log(
      `     - ${pattern.sequence.join(' -> ')} (${(pattern.frequency * 100).toFixed(1)}%)`,
    );
  }
  console.log('');

  // =================================================================
  // 3. Drop-off Detection
  // =================================================================
  console.log('3. Drop-off Detection');
  console.log('-'.repeat(40));

  const dropOffDetector = new DropOffDetector(storage);
  const dropOffResult = await dropOffDetector.detect({
    minConversations: 5,
    minDropOffRate: 0.1,
  });

  console.log(
    `   Overall drop-off rate: ${(dropOffResult.overallDropOffRate * 100).toFixed(1)}%`,
  );
  console.log(
    `   Total conversations analyzed: ${dropOffResult.totalConversations}`,
  );
  console.log('   Drop-off points:');
  for (const point of dropOffResult.dropOffPoints.slice(0, 3)) {
    console.log(
      `     - ${point.stage}: ${(point.dropOffRate * 100).toFixed(1)}% (${point.count} conversations)`,
    );
  }
  console.log('');

  // =================================================================
  // 4. Success Analysis
  // =================================================================
  console.log('4. Success Analysis');
  console.log('-'.repeat(40));

  const successAnalyzer = new SuccessAnalyzer(storage);
  const successResult = await successAnalyzer.analyze();

  console.log(
    `   Overall success rate: ${(successResult.overallSuccessRate * 100).toFixed(1)}%`,
  );
  console.log(
    `   Average satisfaction: ${successResult.avgSatisfaction.toFixed(2)}/5`,
  );
  console.log(`   Total conversations: ${successResult.totalConversations}`);
  console.log('   Success by outcome:');
  for (const [outcome, rate] of Object.entries(
    successResult.successByOutcome,
  )) {
    console.log(`     - ${outcome}: ${(rate * 100).toFixed(1)}%`);
  }
  console.log('');

  // =================================================================
  // 5. Trend Analysis
  // =================================================================
  console.log('5. Trend Analysis');
  console.log('-'.repeat(40));

  const trendAnalyzer = new TrendAnalyzer(storage);
  const trendResult = await trendAnalyzer.analyze({
    compareWindow: 7,
    baselineWindow: 14,
  });

  console.log('   Metrics trends:');
  for (const metric of trendResult.metrics.slice(0, 4)) {
    const arrow =
      metric.trend === 'growing'
        ? '↑'
        : metric.trend === 'declining'
          ? '↓'
          : '→';
    console.log(
      `     - ${metric.name}: ${arrow} ${metric.trend} (${(metric.changePercent * 100).toFixed(1)}%)`,
    );
  }
  console.log('');

  // =================================================================
  // 6. Anomaly Detection
  // =================================================================
  console.log('6. Anomaly Detection');
  console.log('-'.repeat(40));

  const anomalyDetector = new AnomalyDetector(storage);
  const anomalyResult = await anomalyDetector.detect({
    sensitivity: 'medium',
  });

  console.log(`   Anomalies detected: ${anomalyResult.anomalies.length}`);
  if (anomalyResult.anomalies.length > 0) {
    console.log('   Recent anomalies:');
    for (const anomaly of anomalyResult.anomalies.slice(0, 3)) {
      console.log(
        `     - ${anomaly.type}: ${anomaly.description} (severity: ${anomaly.severity})`,
      );
    }
  } else {
    console.log('   No significant anomalies detected');
  }
  console.log('');

  // =================================================================
  // 7. Custom Metrics
  // =================================================================
  console.log('7. Custom Metrics');
  console.log('-'.repeat(40));

  const metricsEngine = new MetricsEngine(storage);
  const customMetrics = new CustomMetrics(storage);

  // Register a custom metric
  customMetrics.register({
    name: 'engagement_score',
    type: 'gauge',
    description: 'Custom engagement score',
    calculator: async (conversations: Conversation[]) => {
      if (conversations.length === 0) return 0;
      const avgMessages =
        conversations.reduce((sum, c) => sum + c.messages.length, 0) /
        conversations.length;
      const successRate =
        conversations.filter((c) => c.outcome?.success).length /
        conversations.length;
      return avgMessages * 0.3 + successRate * 100 * 0.7;
    },
  });

  const engagement = await customMetrics.calculate('engagement_score');
  console.log(`   Custom engagement score: ${engagement.toFixed(2)}`);

  // Built-in metrics
  const successRateMetric = await metricsEngine.calculate('success_rate');
  const avgDuration = await metricsEngine.calculate('avg_duration');
  console.log(
    `   Success rate: ${(successRateMetric.value * 100).toFixed(1)}%`,
  );
  console.log(`   Avg duration: ${(avgDuration.value / 1000).toFixed(2)}s`);
  console.log('');

  // =================================================================
  // 8. Aggregations
  // =================================================================
  console.log('8. Aggregations');
  console.log('-'.repeat(40));

  const aggregations = new Aggregations(storage);

  // Count conversations
  const count = await aggregations.count('week');
  console.log(`   Conversations this week: ${count}`);

  // Sum tokens
  const tokens = await aggregations.sum('tokens', 'week');
  console.log(`   Total tokens: ${tokens}`);

  // Average duration
  const avgDur = await aggregations.avg('duration', 'week');
  console.log(`   Average duration: ${(avgDur / 1000).toFixed(2)}s`);

  // Time series
  const timeSeries = await aggregations.timeSeries(
    'conversations',
    'day',
    'week',
  );
  console.log('   Daily conversation counts:');
  for (const point of timeSeries.slice(-3)) {
    const date = new Date(point.key).toLocaleDateString();
    console.log(`     - ${date}: ${point.value}`);
  }
  console.log('');

  // =================================================================
  // 9. KPI Tracking
  // =================================================================
  console.log('9. KPI Tracking');
  console.log('-'.repeat(40));

  const kpiTracker = new KPITracker(storage);

  // Register KPIs with targets
  kpiTracker.register({
    name: 'success_rate',
    target: 0.8,
    warningThreshold: 0.7,
    criticalThreshold: 0.5,
  });

  kpiTracker.register({
    name: 'avg_satisfaction',
    target: 4.5,
    warningThreshold: 4.0,
    criticalThreshold: 3.0,
  });

  // Get KPI status
  const kpiStatus = await kpiTracker.getStatus();
  console.log('   KPI Status:');
  for (const kpi of kpiStatus) {
    const icon =
      kpi.status === 'on_target' ? '✓' : kpi.status === 'warning' ? '⚠' : '✗';
    console.log(
      `     ${icon} ${kpi.name}: ${kpi.value.toFixed(2)} (target: ${kpi.target})`,
    );
  }
  console.log('');

  // Cleanup
  await analytics.shutdown();
  console.log('='.repeat(60));
  console.log('Done!');
}

main().catch(console.error);
