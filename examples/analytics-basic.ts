/**
 * Analytics Basic Example
 *
 * Demonstrates basic usage of the analytics package.
 */

import {
  Analytics,
  MemoryStorageAdapter,
  IntentClassifier,
  SentimentAnalyzer,
  DashboardData,
  ReportGenerator,
  Exporter,
} from '@lov3kaizen/agentsea-analytics';

async function main() {
  console.log('Analytics Basic Example\n');

  // Create analytics instance with memory storage
  const storage = new MemoryStorageAdapter();
  const analytics = new Analytics({
    enabled: true,
    storage,
  });

  // Initialize
  await analytics.initialize();

  // =================================================================
  // 1. Track Conversations
  // =================================================================
  console.log('1. Tracking conversations...');

  // Start a conversation
  const conversation = await analytics.startConversation({
    userId: 'user-123',
    sessionId: 'session-456',
    metadata: {
      channel: 'web',
      userAgent: 'Mozilla/5.0',
    },
  });
  console.log(`   Started conversation: ${conversation.id}`);

  // Add messages
  await analytics.addMessage(conversation.id, {
    role: 'user',
    content: 'How do I reset my password?',
    conversationId: conversation.id,
  });

  await analytics.addMessage(conversation.id, {
    role: 'assistant',
    content:
      'I can help you reset your password. Please go to the login page and click "Forgot Password".',
    conversationId: conversation.id,
    tokenUsage: { input: 10, output: 25, total: 35 },
    latencyMs: 350,
  });

  await analytics.addMessage(conversation.id, {
    role: 'user',
    content: 'Thank you, that worked perfectly!',
    conversationId: conversation.id,
  });

  // End conversation with outcome
  const endedConversation = await analytics.endConversation(conversation.id, {
    success: true,
    satisfaction: 5,
    feedback: 'Very helpful!',
  });
  console.log(
    `   Ended conversation. Success: ${endedConversation.outcome?.success}\n`,
  );

  // =================================================================
  // 2. Classification
  // =================================================================
  console.log('2. Classifying text...');

  // Intent classification
  const intentClassifier = new IntentClassifier();
  const intent = await intentClassifier.classify('How do I reset my password?');
  console.log(
    `   Intent: ${intent.primary} (confidence: ${intent.confidence.toFixed(2)})`,
  );

  // Sentiment analysis
  const sentimentAnalyzer = new SentimentAnalyzer();
  const sentiment = await sentimentAnalyzer.analyze(
    'Thank you, that worked perfectly!',
  );
  console.log(
    `   Sentiment: ${sentiment.label} (score: ${sentiment.score.toFixed(2)})\n`,
  );

  // =================================================================
  // 3. Dashboard Data
  // =================================================================
  console.log('3. Getting dashboard data...');

  const dashboard = new DashboardData(storage);
  const snapshot = await dashboard.getSnapshot({
    period: 'week',
    includeCharts: true,
    includeRecentConversations: true,
  });

  console.log(`   Period: ${snapshot.period}`);
  console.log('   KPIs:');
  for (const kpi of snapshot.kpis.slice(0, 5)) {
    console.log(`     - ${kpi.name}: ${kpi.value}${kpi.unit ?? ''}`);
  }
  console.log('');

  // =================================================================
  // 4. Generate Report
  // =================================================================
  console.log('4. Generating report...');

  const reportGenerator = new ReportGenerator(storage);
  const report = await reportGenerator.generate({
    title: 'Analytics Report',
    period: 'week',
    includeSummary: true,
    includeKPIs: true,
  });

  console.log(`   Report ID: ${report.id}`);
  console.log(`   Sections: ${report.sections.length}`);
  console.log(`   Summary: ${report.summary.slice(0, 100)}...\n`);

  // =================================================================
  // 5. Export Data
  // =================================================================
  console.log('5. Exporting data...');

  const exporter = new Exporter(storage);

  // Export as JSON
  const jsonExport = await exporter.exportConversations({
    format: 'json',
    period: 'week',
    includeMessages: true,
    pretty: true,
  });
  console.log(
    `   JSON export: ${jsonExport.filename} (${jsonExport.size} bytes)`,
  );

  // Export as CSV
  const csvExport = await exporter.exportConversations({
    format: 'csv',
    period: 'week',
  });
  console.log(`   CSV export: ${csvExport.filename} (${csvExport.size} bytes)`);

  // =================================================================
  // Cleanup
  // =================================================================
  await analytics.shutdown();
  console.log('\nDone!');
}

main().catch(console.error);
