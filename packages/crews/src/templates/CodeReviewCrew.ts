/**
 * Code Review Crew Template
 *
 * Pre-built crew for code review with senior developer, security analyst, and performance engineer agents.
 */

import type {
  CrewConfig,
  CrewAgentConfig,
  RoleConfig,
  TaskConfig,
} from '../types';
import { Crew, createCrew } from '../core';

/**
 * Code review crew options
 */
export interface CodeReviewCrewOptions {
  /** Crew name */
  name?: string;
  /** Model to use for agents */
  model?: string;
  /** LLM provider */
  provider?: string;
  /** Programming languages to focus on */
  languages?: string[];
  /** Include security review */
  includeSecurity?: boolean;
  /** Include performance review */
  includePerformance?: boolean;
  /** Strictness level */
  strictness?: 'relaxed' | 'standard' | 'strict';
  /** Additional tools */
  tools?: string[];
}

/**
 * Senior Developer role configuration
 */
const seniorDeveloperRole: RoleConfig = {
  name: 'Senior Developer',
  description:
    'Expert at reviewing code for quality, maintainability, and best practices. ' +
    'Skilled at architecture review, code quality assessment, and mentoring.',
  capabilities: [
    {
      name: 'code-review',
      description: 'Review code for quality and best practices',
      proficiency: 'expert',
    },
    {
      name: 'architecture-review',
      description: 'Assess code architecture and design',
      proficiency: 'expert',
    },
    {
      name: 'refactoring',
      description: 'Suggest code refactoring improvements',
      proficiency: 'expert',
    },
    {
      name: 'testing-review',
      description: 'Review test coverage and quality',
      proficiency: 'expert',
    },
  ],
  systemPrompt: `You are a senior software developer with extensive experience in code review.

Your approach:
1. Review code for readability and maintainability
2. Check adherence to best practices and design patterns
3. Assess code architecture and structure
4. Evaluate test coverage and quality
5. Provide constructive, educational feedback

Focus on helping developers write better code.`,
  goals: [
    'Ensure code quality and maintainability',
    'Identify potential bugs and issues',
    'Suggest improvements and optimizations',
    'Help developers learn and grow',
  ],
  constraints: [
    'Be constructive, not critical',
    'Explain the "why" behind suggestions',
    'Prioritize important issues over nitpicks',
  ],
};

/**
 * Security Analyst role configuration
 */
const securityAnalystRole: RoleConfig = {
  name: 'Security Analyst',
  description:
    'Expert at identifying security vulnerabilities and ensuring secure coding practices. ' +
    'Skilled at vulnerability assessment, secure code review, and security best practices.',
  capabilities: [
    {
      name: 'vulnerability-detection',
      description: 'Identify security vulnerabilities',
      proficiency: 'expert',
    },
    {
      name: 'secure-coding-review',
      description: 'Review code for security best practices',
      proficiency: 'expert',
    },
    {
      name: 'threat-modeling',
      description: 'Assess potential security threats',
      proficiency: 'expert',
    },
    {
      name: 'compliance-review',
      description: 'Check compliance with security standards',
      proficiency: 'expert',
    },
  ],
  systemPrompt: `You are a security analyst specializing in secure code review.

Your approach:
1. Identify potential security vulnerabilities
2. Check for OWASP Top 10 issues
3. Review authentication and authorization
4. Assess data handling and encryption
5. Evaluate input validation and sanitization

Security is paramount - identify all potential risks.`,
  goals: [
    'Identify security vulnerabilities',
    'Ensure secure coding practices',
    'Protect against common attack vectors',
    'Recommend security improvements',
  ],
  constraints: [
    'Flag all security concerns, even minor ones',
    'Provide remediation guidance',
    'Consider the security context',
  ],
};

/**
 * Performance Engineer role configuration
 */
const performanceEngineerRole: RoleConfig = {
  name: 'Performance Engineer',
  description:
    'Expert at analyzing code for performance issues and optimization opportunities. ' +
    'Skilled at performance profiling, optimization, and scalability assessment.',
  capabilities: [
    {
      name: 'performance-analysis',
      description: 'Analyze code performance',
      proficiency: 'expert',
    },
    {
      name: 'optimization',
      description: 'Suggest performance optimizations',
      proficiency: 'expert',
    },
    {
      name: 'scalability-review',
      description: 'Assess code scalability',
      proficiency: 'expert',
    },
    {
      name: 'resource-analysis',
      description: 'Analyze resource usage',
      proficiency: 'expert',
    },
  ],
  systemPrompt: `You are a performance engineer specializing in code optimization.

Your approach:
1. Identify performance bottlenecks
2. Analyze algorithmic complexity
3. Review memory usage and management
4. Check for unnecessary operations
5. Assess scalability concerns

Help developers write fast, efficient code.`,
  goals: [
    'Identify performance issues',
    'Suggest optimization opportunities',
    'Ensure efficient resource usage',
    'Consider scalability implications',
  ],
  constraints: [
    'Balance optimization with readability',
    'Quantify performance impacts when possible',
    'Consider the actual use case',
  ],
};

/**
 * Create code review crew configuration
 */
export function createCodeReviewCrewConfig(
  options: CodeReviewCrewOptions = {},
): CrewConfig {
  const languagePrompt = options.languages?.length
    ? `\n\nYou specialize in: ${options.languages.join(', ')}`
    : '';

  const strictnessPrompt =
    options.strictness === 'strict'
      ? '\n\nApply strict code review standards.'
      : options.strictness === 'relaxed'
        ? '\n\nFocus on major issues only.'
        : '';

  const agents: CrewAgentConfig[] = [
    {
      name: 'senior-developer',
      role: {
        ...seniorDeveloperRole,
        systemPrompt:
          seniorDeveloperRole.systemPrompt + languagePrompt + strictnessPrompt,
      },
      model: options.model ?? 'claude-sonnet-4-20250514',
      provider: options.provider ?? 'anthropic',
      tools: ['code-analyzer', 'linter', ...(options.tools ?? [])],
      temperature: 0.2,
    },
  ];

  if (options.includeSecurity !== false) {
    agents.push({
      name: 'security-analyst',
      role: {
        ...securityAnalystRole,
        systemPrompt: securityAnalystRole.systemPrompt + languagePrompt,
      },
      model: options.model ?? 'claude-sonnet-4-20250514',
      provider: options.provider ?? 'anthropic',
      tools: [
        'security-scanner',
        'dependency-checker',
        ...(options.tools ?? []),
      ],
      temperature: 0.1,
    });
  }

  if (options.includePerformance !== false) {
    agents.push({
      name: 'performance-engineer',
      role: {
        ...performanceEngineerRole,
        systemPrompt: performanceEngineerRole.systemPrompt + languagePrompt,
      },
      model: options.model ?? 'claude-sonnet-4-20250514',
      provider: options.provider ?? 'anthropic',
      tools: ['profiler', 'complexity-analyzer', ...(options.tools ?? [])],
      temperature: 0.2,
    });
  }

  return {
    name: options.name ?? 'code-review-crew',
    description: 'A code review crew for comprehensive code quality assessment',
    agents,
    delegationStrategy: 'consensus',
    maxIterations: 20,
  };
}

/**
 * Create a code review crew
 */
export function createCodeReviewCrew(
  options: CodeReviewCrewOptions = {},
): Crew {
  const config = createCodeReviewCrewConfig(options);
  return createCrew(config);
}

/**
 * Code review task templates
 */
export const CodeReviewTasks = {
  /**
   * Create a general code review task
   */
  review(code: string, language?: string, context?: string): TaskConfig {
    return {
      description: `Review the following ${language ?? ''} code:\n\n\`\`\`${language ?? ''}\n${code.substring(0, 500)}...\n\`\`\``,
      expectedOutput:
        'Comprehensive code review with issues, suggestions, and improvements',
      priority: 'high',
      requiredCapabilities: ['code-review'],
      context: { language, additionalContext: context, fullCode: code },
    };
  },

  /**
   * Create a security review task
   */
  securityReview(code: string, language?: string): TaskConfig {
    return {
      description: `Perform a security review of the following ${language ?? ''} code:\n\n\`\`\`${language ?? ''}\n${code.substring(0, 500)}...\n\`\`\``,
      expectedOutput:
        'Security assessment with vulnerabilities identified and remediation guidance',
      priority: 'critical',
      requiredCapabilities: ['vulnerability-detection', 'secure-coding-review'],
      context: { language, fullCode: code },
    };
  },

  /**
   * Create a performance review task
   */
  performanceReview(code: string, language?: string): TaskConfig {
    return {
      description: `Analyze the performance of the following ${language ?? ''} code:\n\n\`\`\`${language ?? ''}\n${code.substring(0, 500)}...\n\`\`\``,
      expectedOutput:
        'Performance analysis with bottlenecks identified and optimization suggestions',
      priority: 'high',
      requiredCapabilities: ['performance-analysis', 'optimization'],
      context: { language, fullCode: code },
    };
  },

  /**
   * Create a PR review task
   */
  pullRequestReview(diff: string, prDescription?: string): TaskConfig {
    return {
      description: `Review this pull request:\n\n${prDescription ?? 'No description provided'}\n\nDiff:\n${diff.substring(0, 1000)}...`,
      expectedOutput:
        'PR review with approval/rejection recommendation and detailed feedback',
      priority: 'high',
      requiredCapabilities: ['code-review', 'architecture-review'],
      context: { prDescription, fullDiff: diff },
    };
  },

  /**
   * Create an architecture review task
   */
  architectureReview(description: string, codebase?: string): TaskConfig {
    return {
      description: `Review the architecture described:\n\n${description}`,
      expectedOutput:
        'Architecture assessment with strengths, weaknesses, and recommendations',
      priority: 'high',
      requiredCapabilities: ['architecture-review'],
      context: { codebase },
    };
  },
};

export default createCodeReviewCrew;
