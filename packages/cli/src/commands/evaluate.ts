import chalk from 'chalk';
import inquirer from 'inquirer';
import { table } from 'table';

import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

// Built-in metrics
const METRICS = {
  accuracy: {
    name: 'Accuracy',
    category: 'correctness',
    description: 'Measure response correctness',
  },
  relevance: {
    name: 'Relevance',
    category: 'quality',
    description: 'Measure response relevance to query',
  },
  coherence: {
    name: 'Coherence',
    category: 'quality',
    description: 'Measure logical consistency',
  },
  faithfulness: {
    name: 'Faithfulness',
    category: 'rag',
    description: 'Check grounding in source documents',
  },
  'context-relevance': {
    name: 'Context Relevance',
    category: 'rag',
    description: 'Measure context usefulness for query',
  },
  toxicity: {
    name: 'Toxicity',
    category: 'safety',
    description: 'Detect harmful content',
  },
};

// Judge types
const JUDGES = {
  'llm-judge': {
    name: 'LLM Judge',
    description: 'Use an LLM to evaluate responses',
  },
  'rubric-judge': {
    name: 'Rubric Judge',
    description: 'Score against a defined rubric',
  },
  'comparative-judge': {
    name: 'Comparative Judge',
    description: 'Compare multiple responses',
  },
  'consensus-judge': {
    name: 'Consensus Judge',
    description: 'Multiple judges reach consensus',
  },
};

// Feedback collectors
const FEEDBACK_TYPES = [
  { name: 'Thumbs', value: 'thumbs', description: 'Simple thumbs up/down' },
  { name: 'Rating', value: 'rating', description: 'Star rating (1-5)' },
  {
    name: 'Multi-Criteria',
    value: 'multi-criteria',
    description: 'Rate multiple aspects',
  },
  {
    name: 'Preference',
    value: 'preference',
    description: 'Compare response pairs',
  },
  {
    name: 'Correction',
    value: 'correction',
    description: 'Provide corrections',
  },
];

export interface EvalConfig {
  name: string;
  description?: string;
  metrics: string[];
  judgeType: string;
  judgeModel?: string;
  feedbackType?: string;
  datasetPath?: string;
  threshold?: number;
}

/**
 * Create an evaluation configuration
 */
export async function createEvalConfigCommand(): Promise<void> {
  logger.heading('Create Evaluation Configuration');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Evaluation name:',
      validate: (input) => {
        if (!input.trim()) return 'Name is required';
        const config = configManager.getConfig();
        if (config.evaluations?.[input])
          return 'Evaluation with this name already exists';
        return true;
      },
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description:',
      default: 'An evaluation pipeline',
    },
    {
      type: 'checkbox',
      name: 'metrics',
      message: 'Select metrics to evaluate:',
      choices: Object.entries(METRICS).map(([key, metric]) => ({
        name: `${metric.name} (${metric.category}) - ${metric.description}`,
        value: key,
      })),
      validate: (input) => input.length >= 1 || 'Select at least one metric',
    },
    {
      type: 'list',
      name: 'judgeType',
      message: 'Judge type:',
      choices: Object.entries(JUDGES).map(([key, judge]) => ({
        name: `${judge.name} - ${judge.description}`,
        value: key,
      })),
    },
    {
      type: 'input',
      name: 'judgeModel',
      message: 'Judge model (for LLM judge):',
      default: 'claude-sonnet-4-6',
      when: (answers) => answers.judgeType === 'llm-judge',
    },
    {
      type: 'list',
      name: 'feedbackType',
      message: 'Feedback collection type:',
      choices: [
        { name: 'None', value: undefined },
        ...FEEDBACK_TYPES.map((f) => ({
          name: `${f.name} - ${f.description}`,
          value: f.value,
        })),
      ],
    },
    {
      type: 'input',
      name: 'datasetPath',
      message: 'Evaluation dataset path (optional):',
    },
    {
      type: 'number',
      name: 'threshold',
      message: 'Pass threshold (0-1):',
      default: 0.8,
    },
  ]);

  const evalConfig: EvalConfig = {
    name: answers.name,
    description: answers.description,
    metrics: answers.metrics,
    judgeType: answers.judgeType,
    judgeModel: answers.judgeModel,
    feedbackType: answers.feedbackType,
    datasetPath: answers.datasetPath || undefined,
    threshold: answers.threshold,
  };

  // Save configuration
  const config = configManager.getConfig();
  if (!config.evaluations) {
    config.evaluations = {};
  }
  config.evaluations[answers.name] = evalConfig;
  configManager.setConfig(config);

  logger.success(
    `Evaluation "${answers.name}" configured with ${answers.metrics.length} metrics`,
  );
}

/**
 * List evaluation configurations
 */
export function listEvalsCommand(): void {
  const config = configManager.getConfig();
  const evals = config.evaluations || {};

  if (Object.keys(evals).length === 0) {
    logger.warn('No evaluations configured');
    logger.info('Run `sea evaluate create` to create an evaluation');
    return;
  }

  logger.heading('Configured Evaluations');

  const data = [
    ['Name', 'Metrics', 'Judge', 'Threshold', 'Description'],
    ...(Object.values(evals) as EvalConfig[]).map((eval_) => [
      eval_.name,
      eval_.metrics.length.toString(),
      eval_.judgeType,
      eval_.threshold?.toString() || '-',
      eval_.description || '-',
    ]),
  ];

  console.log(table(data));
}

/**
 * Get evaluation details
 */
export function getEvalCommand(name: string): void {
  const config = configManager.getConfig();
  const eval_ = config.evaluations?.[name] as EvalConfig | undefined;

  if (!eval_) {
    logger.error(`Evaluation "${name}" not found`);
    return;
  }

  const judge = JUDGES[eval_.judgeType as keyof typeof JUDGES];

  logger.heading(`Evaluation: ${eval_.name}`);
  logger.keyValue('Description', eval_.description || '-');
  logger.keyValue('Judge Type', judge?.name || eval_.judgeType);
  logger.keyValue('Judge Model', eval_.judgeModel || '-');
  logger.keyValue('Feedback Type', eval_.feedbackType || 'None');
  logger.keyValue('Dataset Path', eval_.datasetPath || 'None');
  logger.keyValue('Pass Threshold', eval_.threshold?.toString() || '-');

  logger.blank();
  logger.subheading('Metrics');

  const data = [
    ['Metric', 'Category', 'Description'],
    ...eval_.metrics.map((metricId) => {
      const metric = METRICS[metricId as keyof typeof METRICS];
      return [
        metric?.name || metricId,
        metric?.category || '-',
        metric?.description || '-',
      ];
    }),
  ];

  console.log(table(data));
}

/**
 * Delete an evaluation
 */
export async function deleteEvalCommand(name: string): Promise<void> {
  const config = configManager.getConfig();

  if (!config.evaluations?.[name]) {
    logger.error(`Evaluation "${name}" not found`);
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete evaluation "${name}"?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Cancelled');
    return;
  }

  delete config.evaluations[name];
  configManager.setConfig(config);
  logger.success(`Evaluation "${name}" deleted`);
}

/**
 * Show available metrics
 */
export function showMetricsCommand(): void {
  logger.heading('Available Metrics');

  const categories = ['correctness', 'quality', 'rag', 'safety'];

  categories.forEach((category) => {
    logger.blank();
    logger.subheading(category.charAt(0).toUpperCase() + category.slice(1));

    const metrics = Object.entries(METRICS).filter(
      ([_, metric]) => metric.category === category,
    );

    const data = [
      ['ID', 'Name', 'Description'],
      ...metrics.map(([id, metric]) => [id, metric.name, metric.description]),
    ];

    console.log(table(data));
  });
}

/**
 * Show judge types
 */
export function showJudgesCommand(): void {
  logger.heading('Judge Types');
  logger.blank();

  Object.entries(JUDGES).forEach(([key, judge]) => {
    console.log(chalk.bold.cyan(`  ${judge.name}`));
    console.log(chalk.gray(`    ID: ${key}`));
    console.log(chalk.white(`    ${judge.description}`));
    logger.blank();
  });
}

/**
 * Show feedback types
 */
export function showFeedbackTypesCommand(): void {
  logger.heading('Feedback Collection Types');
  logger.blank();

  FEEDBACK_TYPES.forEach((feedback) => {
    console.log(chalk.bold.cyan(`  ${feedback.name}`));
    console.log(chalk.gray(`    ID: ${feedback.value}`));
    console.log(chalk.white(`    ${feedback.description}`));
    logger.blank();
  });
}
