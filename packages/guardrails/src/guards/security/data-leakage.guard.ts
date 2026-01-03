/**
 * Data Leakage Guard
 *
 * Prevents sensitive data from being exposed in outputs.
 */

import type {
  GuardContext,
  GuardResult,
  GuardConfig,
  ContentType,
  DetectionDetail,
} from '../../types';
import { BaseGuard } from '../../core/base-guard';
import { GuardRegistry } from '../../core/guard-registry';

/**
 * Data leakage guard configuration
 */
export interface DataLeakageGuardOptions extends Partial<GuardConfig> {
  /** Block API keys */
  blockApiKeys?: boolean;
  /** Block passwords */
  blockPasswords?: boolean;
  /** Block private keys */
  blockPrivateKeys?: boolean;
  /** Block connection strings */
  blockConnectionStrings?: boolean;
  /** Custom patterns for sensitive data */
  customPatterns?: Record<string, RegExp>;
  /** Enable masking */
  enableMasking?: boolean;
}

/**
 * Data leakage detection details
 */
export interface DataLeakageDetails {
  /** Types of sensitive data found */
  dataTypes: string[];
  /** Count of each type */
  counts: Record<string, number>;
  /** Total sensitive items found */
  totalCount: number;
  /** Masked content (if masking enabled) */
  maskedContent?: string;
}

/**
 * Sensitive data patterns
 */
const SENSITIVE_PATTERNS: Record<
  string,
  { pattern: RegExp; description: string }
> = {
  // API Keys
  aws_access_key: {
    pattern: /\b(AKIA[0-9A-Z]{16})\b/g,
    description: 'AWS Access Key',
  },
  aws_secret_key: {
    pattern: /\b([A-Za-z0-9/+=]{40})\b/g,
    description: 'AWS Secret Key',
  },
  github_token: {
    pattern: /\b(gh[ps]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,})\b/g,
    description: 'GitHub Token',
  },
  openai_api_key: {
    pattern: /\b(sk-[A-Za-z0-9]{32,})\b/g,
    description: 'OpenAI API Key',
  },
  anthropic_api_key: {
    pattern: /\b(sk-ant-[A-Za-z0-9-]{32,})\b/g,
    description: 'Anthropic API Key',
  },
  stripe_key: {
    pattern: /\b(sk_live_[A-Za-z0-9]{24,}|pk_live_[A-Za-z0-9]{24,})\b/g,
    description: 'Stripe API Key',
  },
  generic_api_key: {
    pattern:
      /\b(api[_-]?key|apikey|api[_-]?secret)\s*[=:]\s*['"]?([A-Za-z0-9_-]{20,})['"]?/gi,
    description: 'Generic API Key',
  },

  // Passwords
  password_assignment: {
    pattern:
      /\b(password|passwd|pwd|secret)\s*[=:]\s*['"]?([^\s'"]{8,})['"]?/gi,
    description: 'Password Assignment',
  },
  password_hash: {
    pattern: /\$2[ayb]\$[0-9]{2}\$[A-Za-z0-9./]{53}/g,
    description: 'Bcrypt Hash',
  },

  // Private Keys
  private_key_header: {
    pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/gi,
    description: 'Private Key',
  },
  ssh_private_key: {
    pattern: /-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----/gi,
    description: 'SSH Private Key',
  },

  // Connection Strings
  database_url: {
    pattern: /\b(postgres|mysql|mongodb|redis):\/\/[^\s]+:[^\s]+@[^\s]+/gi,
    description: 'Database Connection String',
  },
  jdbc_url: {
    pattern: /jdbc:[a-z]+:\/\/[^\s]+/gi,
    description: 'JDBC Connection String',
  },

  // Tokens
  jwt_token: {
    pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
    description: 'JWT Token',
  },
  bearer_token: {
    pattern: /\b(Bearer\s+)([A-Za-z0-9_-]{20,})\b/gi,
    description: 'Bearer Token',
  },

  // Environment Variables
  env_sensitive: {
    pattern:
      /\b([A-Z_]+_(?:KEY|SECRET|TOKEN|PASSWORD|PASS|PWD|AUTH))\s*=\s*['"]?([^\s'"]+)['"]?/g,
    description: 'Sensitive Environment Variable',
  },
};

/**
 * Data Leakage Guard
 *
 * Detects and optionally masks sensitive data in outputs.
 */
export class DataLeakageGuard extends BaseGuard<void, DataLeakageDetails> {
  readonly name = 'data-leakage';
  readonly supportedTypes: ContentType[] = ['output'];

  private patterns: Map<string, { pattern: RegExp; description: string }>;
  private enableMasking: boolean;

  constructor(options: DataLeakageGuardOptions = {}) {
    super(options);
    this.enableMasking = options.enableMasking ?? true;

    // Build patterns based on options
    this.patterns = new Map();

    const blockApiKeys = options.blockApiKeys ?? true;
    const blockPasswords = options.blockPasswords ?? true;
    const blockPrivateKeys = options.blockPrivateKeys ?? true;
    const blockConnectionStrings = options.blockConnectionStrings ?? true;

    for (const [name, info] of Object.entries(SENSITIVE_PATTERNS)) {
      // Filter based on options
      if (!blockApiKeys && name.includes('api_key')) continue;
      if (!blockApiKeys && name.includes('token')) continue;
      if (!blockPasswords && name.includes('password')) continue;
      if (!blockPrivateKeys && name.includes('private_key')) continue;
      if (
        !blockConnectionStrings &&
        (name.includes('url') || name.includes('jdbc'))
      )
        continue;

      this.patterns.set(name, info);
    }

    // Add custom patterns
    if (options.customPatterns) {
      for (const [name, pattern] of Object.entries(options.customPatterns)) {
        this.patterns.set(name, {
          pattern,
          description: `Custom: ${name}`,
        });
      }
    }
  }

  protected doCheck(
    context: GuardContext,
  ): Promise<GuardResult<DataLeakageDetails>> {
    const { input } = context;
    const dataTypes: string[] = [];
    const counts: Record<string, number> = {};
    const detections: DetectionDetail[] = [];
    let totalCount = 0;

    // Check each pattern
    for (const [name, { pattern, description }] of this.patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      const matches: RegExpExecArray[] = [];
      let match;

      while ((match = regex.exec(input)) !== null) {
        matches.push(match);
      }

      if (matches.length > 0) {
        dataTypes.push(name);
        counts[name] = matches.length;
        totalCount += matches.length;

        for (const m of matches) {
          detections.push({
            category: name,
            pattern: description,
            startIndex: m.index,
            endIndex: m.index + m[0].length,
            matchedText: this.maskValue(m[0]),
          });
        }
      }
    }

    const details: DataLeakageDetails = {
      dataTypes,
      counts,
      totalCount,
    };

    if (totalCount > 0) {
      // Apply masking if configured
      if (this.config.onFailure === 'transform' && this.enableMasking) {
        const maskedContent = this.maskAllSensitiveData(input);
        details.maskedContent = maskedContent;

        return Promise.resolve(
          this.transformed(
            maskedContent,
            details,
            `Found and masked ${totalCount} sensitive data item(s): ${dataTypes.join(', ')}`,
          ),
        );
      }

      return Promise.resolve(
        this.fail(
          `Found ${totalCount} sensitive data item(s): ${dataTypes.join(', ')}`,
          details,
          detections,
        ),
      );
    }

    return Promise.resolve(this.pass(details, 'No sensitive data detected'));
  }

  /**
   * Transform function to mask sensitive data
   */
  transform(content: string): Promise<string> {
    return Promise.resolve(this.maskAllSensitiveData(content));
  }

  /**
   * Mask a single sensitive value
   */
  private maskValue(value: string): string {
    if (value.length <= 8) {
      return '*'.repeat(value.length);
    }
    // Show first 4 and last 4 characters
    return (
      value.slice(0, 4) +
      '*'.repeat(Math.max(4, value.length - 8)) +
      value.slice(-4)
    );
  }

  /**
   * Mask all sensitive data in content
   */
  private maskAllSensitiveData(content: string): string {
    let masked = content;

    for (const [, { pattern }] of this.patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      masked = masked.replace(regex, (match) => this.maskValue(match));
    }

    return masked;
  }
}

// Register the guard
GuardRegistry.register({
  metadata: {
    name: 'data-leakage',
    description: 'Prevents sensitive data from being exposed in outputs',
    category: 'security',
    supportedTypes: ['output'],
    defaultConfig: {
      enabled: true,
      onFailure: 'block',
      threshold: 0.0,
      sensitivity: 'high',
    },
  },
  factory: (config) => new DataLeakageGuard(config),
});

export default DataLeakageGuard;
