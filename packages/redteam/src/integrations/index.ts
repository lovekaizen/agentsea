/**
 * Integrations Module - Third-party Integrations
 *
 * Integration adapters for AgentSea, CI/CD pipelines,
 * and other external services.
 */

// Re-export types for integration configuration
export type {
  TargetConfig,
  AuthConfig,
  RedTeamConfig,
} from '../types/config.types.js';

/**
 * AgentSea Integration for Red Team Testing
 */
export interface AgentSeaIntegrationConfig {
  /** Enable red team middleware */
  enabled: boolean;
  /** Detection types to enable */
  detection?: {
    jailbreak?: boolean;
    leakage?: boolean;
    bias?: boolean;
  };
  /** Blocking mode - block detected threats */
  blocking?: boolean;
  /** Alert on detection */
  alertOnDetection?: boolean;
  /** Custom handler */
  onDetection?: (detection: unknown) => void;
}

/**
 * CI/CD Integration Configuration
 */
export interface CIIntegrationConfig {
  /** CI provider */
  provider: 'github' | 'gitlab' | 'jenkins' | 'azure' | 'custom';
  /** Fail build on critical */
  failOnCritical?: boolean;
  /** Fail threshold */
  failThreshold?: {
    critical?: number;
    high?: number;
    riskScore?: number;
  };
  /** Output format */
  outputFormat?: 'json' | 'junit' | 'sarif';
  /** Output path */
  outputPath?: string;
  /** Create annotations */
  createAnnotations?: boolean;
}

/**
 * Create AgentSea integration middleware
 */
export function createAgentSeaIntegration(config: AgentSeaIntegrationConfig) {
  return {
    config,
    // Placeholder for middleware implementation
    middleware: async (ctx: unknown, next: () => Promise<void>) => {
      await next();
    },
  };
}

/**
 * Create CI integration reporter
 */
export function createCIIntegration(config: CIIntegrationConfig) {
  return {
    config,
    // Placeholder for CI reporter implementation
    report: (_results: unknown) => {
      console.log('CI Report:', config.provider);
    },
  };
}
