# @lov3kaizen/agentsea-evaluate

Comprehensive feedback collection and LLM evaluation platform for Node.js. Build production-ready evaluation pipelines with human-in-the-loop annotation, automated metrics, LLM-as-Judge, and preference dataset generation.

## Features

- **Evaluation Metrics** - Built-in metrics for accuracy, relevance, coherence, toxicity, faithfulness, and more
- **LLM-as-Judge** - Use LLMs to evaluate responses with rubric-based and comparative scoring
- **Human Feedback** - Collect ratings, rankings, and corrections from annotators
- **Dataset Management** - Create, import, and manage evaluation datasets with HuggingFace integration
- **Continuous Evaluation** - Monitor production quality with automated evaluation pipelines
- **Preference Learning** - Generate datasets for RLHF, DPO, and preference optimization

## Installation

```bash
pnpm add @lov3kaizen/agentsea-evaluate
```

## Quick Start

```typescript
import {
  EvaluationPipeline,
  AccuracyMetric,
  RelevanceMetric,
  LLMJudge,
  EvalDataset,
} from '@lov3kaizen/agentsea-evaluate';

// Create metrics
const accuracy = new AccuracyMetric({ type: 'fuzzy' });
const relevance = new RelevanceMetric();

// Create evaluation pipeline
const pipeline = new EvaluationPipeline({
  metrics: [accuracy, relevance],
  parallelism: 5,
});

// Create dataset
const dataset = new EvalDataset({
  items: [
    {
      id: '1',
      input: 'What is the capital of France?',
      expectedOutput: 'Paris',
    },
    {
      id: '2',
      input: 'What is 2 + 2?',
      expectedOutput: '4',
    },
  ],
});

// Run evaluation
const results = await pipeline.evaluate({
  dataset,
  generateFn: async (input) => {
    // Your LLM generation function
    return await myAgent.run(input);
  },
});

console.log(results.summary);
// { passRate: 0.95, avgScore: 0.87, ... }
```

## Metrics

### Built-in Metrics

| Metric                   | Description                                             |
| ------------------------ | ------------------------------------------------------- |
| `AccuracyMetric`         | Exact, fuzzy, or semantic match against expected output |
| `RelevanceMetric`        | How relevant the response is to the input               |
| `CoherenceMetric`        | Logical flow and consistency of the response            |
| `ToxicityMetric`         | Detection of harmful or inappropriate content           |
| `FaithfulnessMetric`     | Factual accuracy relative to provided context (RAG)     |
| `ContextRelevanceMetric` | Relevance of retrieved context (RAG)                    |
| `FluencyMetric`          | Grammar, spelling, and readability                      |
| `ConcisenessMetric`      | Brevity without losing important information            |
| `HelpfulnessMetric`      | How helpful the response is to the user                 |
| `SafetyMetric`           | Detection of unsafe or harmful outputs                  |

### Custom Metrics

```typescript
import {
  BaseMetric,
  MetricResult,
  EvaluationInput,
} from '@lov3kaizen/agentsea-evaluate';

class CustomMetric extends BaseMetric {
  readonly type = 'custom';
  readonly name = 'my-metric';

  async evaluate(input: EvaluationInput): Promise<MetricResult> {
    // Your evaluation logic
    const score = calculateScore(input.output, input.expectedOutput);

    return {
      metric: this.name,
      score,
      explanation: `Score: ${score}`,
    };
  }
}
```

## LLM-as-Judge

### Rubric-Based Evaluation

```typescript
import { RubricJudge } from '@lov3kaizen/agentsea-evaluate';

const judge = new RubricJudge({
  provider: anthropicProvider,
  rubric: {
    criteria: 'Response Quality',
    levels: [
      { score: 1, description: 'Poor - Incorrect or irrelevant' },
      { score: 2, description: 'Fair - Partially correct' },
      { score: 3, description: 'Good - Correct but incomplete' },
      { score: 4, description: 'Very Good - Correct and complete' },
      {
        score: 5,
        description: 'Excellent - Correct, complete, and well-explained',
      },
    ],
  },
});

const result = await judge.evaluate({
  input: 'Explain quantum entanglement',
  output: response,
});
```

### Comparative Evaluation

```typescript
import { ComparativeJudge } from '@lov3kaizen/agentsea-evaluate';

const judge = new ComparativeJudge({
  provider: openaiProvider,
  criteria: ['accuracy', 'helpfulness', 'clarity'],
});

const result = await judge.compare({
  input: 'Summarize this article',
  responseA: modelAOutput,
  responseB: modelBOutput,
});
// { winner: 'A', reasoning: '...', criteriaScores: {...} }
```

## Human Feedback

### Rating Collector

```typescript
import { RatingCollector } from '@lov3kaizen/agentsea-evaluate/feedback';

const collector = new RatingCollector({
  scale: 5,
  criteria: ['accuracy', 'helpfulness', 'clarity'],
});

// Collect feedback
await collector.collect({
  itemId: 'response-123',
  input: 'What is ML?',
  output: 'Machine Learning is...',
  annotatorId: 'user-1',
  ratings: {
    accuracy: 4,
    helpfulness: 5,
    clarity: 4,
  },
  comment: 'Good explanation',
});

// Get aggregated scores
const stats = collector.getStatistics('response-123');
```

### Preference Collection

```typescript
import { PreferenceCollector } from '@lov3kaizen/agentsea-evaluate/feedback';

const collector = new PreferenceCollector();

// Collect A/B preferences
await collector.collect({
  input: 'Explain recursion',
  responseA: '...',
  responseB: '...',
  preference: 'A',
  annotatorId: 'user-1',
  reason: 'More concise explanation',
});

// Export for RLHF/DPO training
const dataset = collector.exportForDPO();
```

## Datasets

### Create Dataset

```typescript
import { EvalDataset } from '@lov3kaizen/agentsea-evaluate/datasets';

const dataset = new EvalDataset({
  name: 'qa-benchmark',
  items: [
    {
      id: '1',
      input: 'Question 1',
      expectedOutput: 'Answer 1',
      context: ['Relevant context...'],
      tags: ['factual', 'science'],
    },
  ],
});

// Filter and sample
const subset = dataset
  .filter((item) => item.tags?.includes('science'))
  .sample(100);

// Split for train/test
const [train, test] = dataset.split(0.8);
```

### HuggingFace Integration

```typescript
import { loadHuggingFaceDataset } from '@lov3kaizen/agentsea-evaluate/datasets';

const dataset = await loadHuggingFaceDataset('squad', {
  split: 'validation',
  inputField: 'question',
  outputField: 'answers.text[0]',
  contextField: 'context',
  limit: 1000,
});
```

## Continuous Evaluation

### Production Monitoring

```typescript
import { ContinuousEvaluator } from '@lov3kaizen/agentsea-evaluate/continuous';

const evaluator = new ContinuousEvaluator({
  metrics: [accuracy, relevance, toxicity],
  sampleRate: 0.1, // Evaluate 10% of requests
  alertThresholds: {
    accuracy: 0.8,
    toxicity: 0.1,
  },
});

// In your production code
evaluator.on('alert', (alert) => {
  console.error(`Quality alert: ${alert.metric} below threshold`);
  notifyOncall(alert);
});

// Log production interactions
await evaluator.log({
  input: userQuery,
  output: agentResponse,
  expectedOutput: groundTruth, // Optional
});
```

## API Reference

### EvaluationPipeline

```typescript
interface EvaluationPipelineConfig {
  metrics: MetricInterface[];
  llmJudge?: JudgeInterface;
  parallelism?: number;
  timeout?: number;
  retries?: number;
}

// Methods
pipeline.evaluate(options: PipelineEvaluationOptions): Promise<PipelineEvaluationResult>
```

### EvalDataset

```typescript
interface EvalDatasetItem {
  id: string;
  input: string;
  expectedOutput?: string;
  context?: string[];
  reference?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

// Methods
dataset.getItems(): EvalDatasetItem[]
dataset.filter(predicate): EvalDataset
dataset.sample(count): EvalDataset
dataset.split(ratio): [EvalDataset, EvalDataset]
```

### PipelineEvaluationResult

```typescript
interface PipelineEvaluationResult {
  results: SingleEvaluationResult[];
  metrics: MetricsSummary;
  failures: FailureAnalysis[];
  summary: EvaluationSummary;
  exportJSON(): string;
  exportCSV(): string;
}
```

## Links

- [Documentation](https://github.com/lov3kaizen/agentsea)
- [Examples](../../examples)
- [API Reference](../../docs/API.md)
