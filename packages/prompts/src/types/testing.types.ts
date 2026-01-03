/**
 * A/B Testing Type Definitions
 */

/**
 * Test variant configuration
 */
export interface TestVariant {
  name: string;
  version: string;
  weight: number; // 0-1, total of all variants should be 1
  description?: string;
}

/**
 * A/B Test configuration
 */
export interface ABTestConfig {
  name: string;
  prompt: string; // Prompt name
  variants: TestVariant[];
  metrics: string[];
  targetSampleSize?: number;
  confidenceLevel?: number; // Default 0.95
  startDate?: Date;
  endDate?: Date;
  description?: string;
}

/**
 * A/B Test data
 */
export interface ABTestData extends ABTestConfig {
  id: string;
  status: ABTestStatus;
  createdAt: Date;
  createdBy?: string;
  startedAt?: Date;
  endedAt?: Date;
  winner?: string;
}

/**
 * A/B Test status
 */
export type ABTestStatus =
  | 'draft'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled';

/**
 * Variant assignment
 */
export interface VariantAssignment {
  testId: string;
  userId: string;
  variant: string;
  version: string;
  assignedAt: Date;
}

/**
 * Metric recording
 */
export interface MetricRecord {
  testId: string;
  variant: string;
  metric: string;
  value: number;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Variant statistics
 */
export interface VariantStats {
  name: string;
  sampleSize: number;
  metrics: Record<
    string,
    {
      mean: number;
      stdDev: number;
      min: number;
      max: number;
      median: number;
      count: number;
    }
  >;
}

/**
 * Test results
 */
export interface ABTestResults {
  testId: string;
  testName: string;
  status: ABTestStatus;
  totalSamples: number;
  variants: Record<string, VariantStats>;
  comparisons: MetricComparison[];
  isSignificant: boolean;
  winner?: string;
  pValue?: number;
  confidenceInterval?: [number, number];
  recommendation?: string;
}

/**
 * Metric comparison between variants
 */
export interface MetricComparison {
  metric: string;
  control: {
    variant: string;
    mean: number;
    stdDev: number;
  };
  treatment: {
    variant: string;
    mean: number;
    stdDev: number;
  };
  absoluteDifference: number;
  relativeDifference: number; // Percentage
  pValue: number;
  isSignificant: boolean;
  confidenceInterval: [number, number];
}

/**
 * Get variant options
 */
export interface GetVariantOptions {
  userId: string;
  sessionId?: string;
  attributes?: Record<string, unknown>;
}

/**
 * Test assertion types
 */
export type AssertionType =
  | 'contains'
  | 'not_contains'
  | 'matches'
  | 'equals'
  | 'length_min'
  | 'length_max'
  | 'json_valid'
  | 'custom';

/**
 * Test assertion
 */
export interface TestAssertion {
  type: AssertionType;
  value?: string | number | RegExp;
  customFn?: (output: string) => boolean;
  message?: string;
}

/**
 * Test case definition
 */
export interface TestCase {
  id: string;
  name: string;
  promptName: string;
  version?: string;
  variables: Record<string, unknown>;
  assertions: TestAssertion[];
  description?: string;
  tags?: string[];
}

/**
 * Test case result
 */
export interface TestCaseResult {
  testCase: TestCase;
  passed: boolean;
  output?: string;
  assertionResults: {
    assertion: TestAssertion;
    passed: boolean;
    message?: string;
  }[];
  duration: number;
  error?: string;
}

/**
 * Test run result
 */
export interface TestRunResult {
  id: string;
  promptName: string;
  version: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  results: TestCaseResult[];
  timestamp: Date;
}
