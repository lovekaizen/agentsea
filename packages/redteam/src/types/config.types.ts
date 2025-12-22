/**
 * Configuration Types for Red Team Toolkit
 */

import type {
  AttackCategory,
  Severity,
  AttackExecutionOptions,
} from './attack.types.js';
import type { BenchmarkConfig } from './benchmark.types.js';
import type { ComplianceConfig } from './compliance.types.js';
import type { DetectionConfig } from './detection.types.js';
import type { ScanConfig } from './scanning.types.js';
import type {
  AuditLogConfig,
  EvidenceCollectionConfig,
} from './audit.types.js';
import type { ContinuousTestingConfig } from './continuous.types.js';

/**
 * Main RedTeam configuration
 */
export interface RedTeamConfig {
  /** Configuration name */
  name?: string;
  /** Description */
  description?: string;
  /** Target configuration */
  target: TargetConfig;
  /** Attack configuration */
  attacks?: AttackConfig;
  /** Test configuration */
  tests?: TestConfig;
  /** Scan configuration */
  scanning?: Partial<ScanConfig>;
  /** Benchmark configuration */
  benchmarks?: Partial<BenchmarkConfig>;
  /** Compliance configuration */
  compliance?: Partial<ComplianceConfig>;
  /** Detection configuration */
  detection?: Partial<DetectionConfig>;
  /** Audit configuration */
  audit?: Partial<AuditLogConfig>;
  /** Evidence configuration */
  evidence?: Partial<EvidenceCollectionConfig>;
  /** Continuous testing configuration */
  continuous?: Partial<ContinuousTestingConfig>;
  /** Reporting configuration */
  reporting?: ReportingConfig;
  /** Global settings */
  settings?: GlobalSettings;
}

/**
 * Target configuration
 */
export interface TargetConfig {
  /** Target type */
  type: 'agent' | 'api' | 'model' | 'endpoint' | 'custom';
  /** Target name */
  name: string;
  /** Endpoint URL */
  endpoint?: string;
  /** Model identifier */
  model?: string;
  /** System prompt */
  systemPrompt?: string;
  /** Authentication */
  authentication?: AuthConfig;
  /** Headers */
  headers?: Record<string, string>;
  /** Timeout (ms) */
  timeout?: number;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /** Auth type */
  type: 'api_key' | 'bearer' | 'basic' | 'oauth2' | 'custom';
  /** API key */
  apiKey?: string;
  /** Bearer token */
  token?: string;
  /** Basic auth credentials */
  basic?: {
    username: string;
    password: string;
  };
  /** OAuth2 config */
  oauth2?: {
    clientId: string;
    clientSecret: string;
    tokenUrl: string;
    scopes?: string[];
  };
  /** Header name */
  headerName?: string;
  /** Custom auth function */
  customAuth?: string;
}

/**
 * Attack configuration
 */
export interface AttackConfig {
  /** Enabled attack categories */
  categories?: AttackCategory[];
  /** Specific attacks to include */
  include?: string[];
  /** Attacks to exclude */
  exclude?: string[];
  /** Severity filter */
  minSeverity?: Severity;
  /** Max attacks to run */
  maxAttacks?: number;
  /** Randomize order */
  randomize?: boolean;
  /** Seed for randomization */
  seed?: number;
  /** Execution options */
  executionOptions?: AttackExecutionOptions;
  /** Custom attack payloads */
  customPayloads?: CustomPayload[];
  /** Mutation options */
  mutations?: MutationConfig;
}

/**
 * Custom payload
 */
export interface CustomPayload {
  /** Payload ID */
  id: string;
  /** Name */
  name: string;
  /** Category */
  category: AttackCategory;
  /** Severity */
  severity: Severity;
  /** Payload content */
  payload: string;
  /** Tags */
  tags?: string[];
}

/**
 * Mutation configuration
 */
export interface MutationConfig {
  /** Enable mutations */
  enabled: boolean;
  /** Mutations per attack */
  mutationsPerAttack?: number;
  /** Mutation types to use */
  mutationTypes?: string[];
  /** Combination depth */
  combinationDepth?: number;
}

/**
 * Test configuration
 */
export interface TestConfig {
  /** Test suites to run */
  suites?: string[];
  /** Parallel execution */
  parallel?: boolean;
  /** Max parallel tests */
  maxParallel?: number;
  /** Stop on first failure */
  failFast?: boolean;
  /** Timeout per test (ms) */
  testTimeout?: number;
  /** Retry failed tests */
  retries?: number;
  /** Filter by tags */
  tags?: string[];
  /** Skip tags */
  skipTags?: string[];
  /** Reporter */
  reporter?: ReporterConfig;
}

/**
 * Reporter configuration
 */
export interface ReporterConfig {
  /** Reporter type */
  type: 'console' | 'json' | 'junit' | 'html' | 'custom';
  /** Output path */
  outputPath?: string;
  /** Verbose output */
  verbose?: boolean;
  /** Include timestamps */
  timestamps?: boolean;
  /** Color output */
  colors?: boolean;
  /** Custom reporter function */
  customReporter?: string;
}

/**
 * Reporting configuration
 */
export interface ReportingConfig {
  /** Generate reports */
  enabled: boolean;
  /** Report formats */
  formats: ('json' | 'html' | 'pdf' | 'markdown')[];
  /** Output directory */
  outputDir?: string;
  /** Include sections */
  sections?: ReportSection[];
  /** Branding */
  branding?: BrandingConfig;
  /** Auto-generate on completion */
  autoGenerate?: boolean;
  /** Include raw data */
  includeRawData?: boolean;
  /** Include evidence */
  includeEvidence?: boolean;
}

/**
 * Report sections
 */
export type ReportSection =
  | 'executive_summary'
  | 'methodology'
  | 'findings'
  | 'vulnerabilities'
  | 'compliance'
  | 'benchmarks'
  | 'recommendations'
  | 'appendix';

/**
 * Branding configuration
 */
export interface BrandingConfig {
  /** Logo URL or path */
  logo?: string;
  /** Company name */
  companyName?: string;
  /** Primary color */
  primaryColor?: string;
  /** Secondary color */
  secondaryColor?: string;
  /** Footer text */
  footerText?: string;
}

/**
 * Global settings
 */
export interface GlobalSettings {
  /** Logging level */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** Dry run (don't execute) */
  dryRun?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Quiet mode */
  quiet?: boolean;
  /** Working directory */
  workingDir?: string;
  /** Temp directory */
  tempDir?: string;
  /** Max retries for network calls */
  maxRetries?: number;
  /** Retry delay (ms) */
  retryDelay?: number;
  /** Rate limiting */
  rateLimit?: {
    requestsPerSecond: number;
    burstSize?: number;
  };
  /** Proxy settings */
  proxy?: ProxyConfig;
  /** Environment variables */
  env?: Record<string, string>;
}

/**
 * Proxy configuration
 */
export interface ProxyConfig {
  /** Proxy URL */
  url: string;
  /** Username */
  username?: string;
  /** Password */
  password?: string;
  /** Bypass for hosts */
  bypass?: string[];
}

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  /** Environment name */
  name: string;
  /** Base configuration to extend */
  extends?: string;
  /** Override target */
  target?: Partial<TargetConfig>;
  /** Override attacks */
  attacks?: Partial<AttackConfig>;
  /** Override tests */
  tests?: Partial<TestConfig>;
  /** Override settings */
  settings?: Partial<GlobalSettings>;
  /** Environment-specific variables */
  variables?: Record<string, string>;
}

/**
 * Profile configuration (preset configurations)
 */
export interface ProfileConfig {
  /** Profile name */
  name: string;
  /** Description */
  description?: string;
  /** Base configuration */
  config: Partial<RedTeamConfig>;
  /** Tags */
  tags?: string[];
}

/**
 * Built-in profiles
 */
export type BuiltInProfile =
  | 'quick' // Fast, basic checks
  | 'standard' // Balanced coverage
  | 'comprehensive' // Full testing
  | 'compliance' // Compliance-focused
  | 'security' // Security-focused
  | 'ci' // CI/CD optimized
  | 'production'; // Production-safe

/**
 * Configuration file schema
 */
export interface ConfigFile {
  /** Schema version */
  version: string;
  /** Main configuration */
  redteam: RedTeamConfig;
  /** Environments */
  environments?: Record<string, EnvironmentConfig>;
  /** Profiles */
  profiles?: Record<string, ProfileConfig>;
  /** Defaults */
  defaults?: Partial<RedTeamConfig>;
}

/**
 * CLI options
 */
export interface CLIOptions {
  /** Config file path */
  config?: string;
  /** Profile to use */
  profile?: string;
  /** Environment */
  environment?: string;
  /** Target override */
  target?: string;
  /** Output directory */
  output?: string;
  /** Report format */
  format?: string;
  /** Verbose */
  verbose?: boolean;
  /** Quiet */
  quiet?: boolean;
  /** Dry run */
  dryRun?: boolean;
  /** Parallel */
  parallel?: boolean;
  /** Fail fast */
  failFast?: boolean;
  /** Tags to run */
  tags?: string[];
  /** Tags to skip */
  skipTags?: string[];
}

/**
 * Plugin configuration
 */
export interface PluginConfig {
  /** Plugin name */
  name: string;
  /** Plugin version */
  version?: string;
  /** Enabled */
  enabled: boolean;
  /** Plugin options */
  options?: Record<string, unknown>;
}

/**
 * Extension points
 */
export interface ExtensionPoints {
  /** Custom attack generators */
  attackGenerators?: string[];
  /** Custom detectors */
  detectors?: string[];
  /** Custom reporters */
  reporters?: string[];
  /** Custom benchmarks */
  benchmarks?: string[];
  /** Custom compliance frameworks */
  complianceFrameworks?: string[];
  /** Hooks */
  hooks?: HooksConfig;
}

/**
 * Hooks configuration
 */
export interface HooksConfig {
  /** Before run */
  beforeRun?: string;
  /** After run */
  afterRun?: string;
  /** Before test */
  beforeTest?: string;
  /** After test */
  afterTest?: string;
  /** On vulnerability */
  onVulnerability?: string;
  /** On alert */
  onAlert?: string;
}
