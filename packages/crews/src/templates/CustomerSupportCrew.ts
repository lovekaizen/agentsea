/**
 * Customer Support Crew Template
 *
 * Pre-built crew for customer support with tier 1 agent, specialist, and escalation manager.
 */

import type {
  CrewConfig,
  CrewAgentConfig,
  RoleConfig,
  TaskConfig,
} from '../types';
import { Crew, createCrew } from '../core';

/**
 * Customer support crew options
 */
export interface CustomerSupportCrewOptions {
  /** Crew name */
  name?: string;
  /** Model to use for agents */
  model?: string;
  /** LLM provider */
  provider?: string;
  /** Product/service name */
  productName?: string;
  /** Company name */
  companyName?: string;
  /** Support style */
  supportStyle?: 'formal' | 'friendly' | 'technical';
  /** Include specialist */
  includeSpecialist?: boolean;
  /** Include escalation manager */
  includeEscalation?: boolean;
  /** Additional tools */
  tools?: string[];
}

/**
 * Tier 1 Support Agent role configuration
 */
const tier1AgentRole: RoleConfig = {
  name: 'Tier 1 Support Agent',
  description:
    'Expert at initial customer contact, issue triage, and common problem resolution. ' +
    'Skilled at empathetic communication, quick issue assessment, and knowledge base usage.',
  capabilities: [
    {
      name: 'issue-triage',
      description: 'Quickly assess and categorize issues',
      proficiency: 'expert',
    },
    {
      name: 'common-resolution',
      description: 'Resolve common support issues',
      proficiency: 'expert',
    },
    {
      name: 'empathetic-communication',
      description: 'Communicate with empathy and patience',
      proficiency: 'expert',
    },
    {
      name: 'knowledge-base-search',
      description: 'Find solutions in knowledge base',
      proficiency: 'expert',
    },
  ],
  systemPrompt: `You are a Tier 1 customer support agent, the first point of contact for customers.

Your approach:
1. Greet the customer warmly and acknowledge their issue
2. Gather necessary information to understand the problem
3. Check the knowledge base for solutions
4. Provide clear, step-by-step guidance
5. Escalate complex issues appropriately

Always be patient, empathetic, and professional.`,
  goals: [
    'Resolve issues on first contact when possible',
    'Provide excellent customer experience',
    'Accurately assess and triage issues',
    'Escalate appropriately when needed',
  ],
  constraints: [
    'Never argue with customers',
    'Always verify customer identity for sensitive issues',
    'Follow company policies and procedures',
  ],
};

/**
 * Support Specialist role configuration
 */
const specialistRole: RoleConfig = {
  name: 'Support Specialist',
  description:
    'Expert at handling complex technical issues and advanced troubleshooting. ' +
    'Skilled at deep technical investigation, root cause analysis, and solution development.',
  capabilities: [
    {
      name: 'advanced-troubleshooting',
      description: 'Handle complex technical issues',
      proficiency: 'expert',
    },
    {
      name: 'root-cause-analysis',
      description: 'Identify root causes of problems',
      proficiency: 'expert',
    },
    {
      name: 'technical-investigation',
      description: 'Conduct deep technical investigations',
      proficiency: 'expert',
    },
    {
      name: 'solution-development',
      description: 'Develop custom solutions',
      proficiency: 'expert',
    },
  ],
  systemPrompt: `You are a technical support specialist handling complex customer issues.

Your approach:
1. Review the issue history and initial triage
2. Conduct thorough technical investigation
3. Identify the root cause of the problem
4. Develop and test a solution
5. Document the resolution for future reference

Solve the problem completely and permanently when possible.`,
  goals: [
    'Resolve complex technical issues',
    'Identify and fix root causes',
    'Reduce recurring issues',
    'Build knowledge for future cases',
  ],
  constraints: [
    'Document all findings and solutions',
    'Test solutions before implementing',
    'Consider impact on other systems',
  ],
};

/**
 * Escalation Manager role configuration
 */
const escalationManagerRole: RoleConfig = {
  name: 'Escalation Manager',
  description:
    'Expert at handling critical escalations, VIP customers, and complex situations. ' +
    'Skilled at conflict resolution, executive communication, and crisis management.',
  capabilities: [
    {
      name: 'crisis-management',
      description: 'Handle crisis situations effectively',
      proficiency: 'expert',
    },
    {
      name: 'conflict-resolution',
      description: 'Resolve customer conflicts',
      proficiency: 'expert',
    },
    {
      name: 'executive-communication',
      description: 'Communicate at executive level',
      proficiency: 'expert',
    },
    {
      name: 'decision-making',
      description: 'Make critical support decisions',
      proficiency: 'expert',
    },
  ],
  systemPrompt: `You are an escalation manager handling the most critical customer situations.

Your approach:
1. Review the full case history
2. Assess the severity and business impact
3. Take ownership of the situation
4. Coordinate resources to resolve
5. Communicate with all stakeholders

Turn difficult situations into positive outcomes.`,
  goals: [
    'Resolve critical escalations',
    'Retain at-risk customers',
    'Protect company reputation',
    'Improve processes to prevent escalations',
  ],
  constraints: [
    'Authority to make exceptions when justified',
    'Document all decisions and rationale',
    'Balance customer needs with business interests',
  ],
};

/**
 * Create customer support crew configuration
 */
export function createCustomerSupportCrewConfig(
  options: CustomerSupportCrewOptions = {},
): CrewConfig {
  const companyContext = options.companyName
    ? `\n\nYou work for ${options.companyName}.`
    : '';

  const productContext = options.productName
    ? `\n\nYou support ${options.productName}.`
    : '';

  const styleContext =
    options.supportStyle === 'formal'
      ? '\n\nMaintain a formal, professional tone.'
      : options.supportStyle === 'friendly'
        ? '\n\nBe warm, friendly, and approachable.'
        : options.supportStyle === 'technical'
          ? '\n\nFocus on technical accuracy and detail.'
          : '';

  const contextAddition = companyContext + productContext + styleContext;

  const agents: CrewAgentConfig[] = [
    {
      name: 'tier1-agent',
      role: {
        ...tier1AgentRole,
        systemPrompt: tier1AgentRole.systemPrompt + contextAddition,
      },
      model: options.model ?? 'claude-opus-4-8',
      provider: options.provider ?? 'anthropic',
      tools: ['knowledge-base', 'ticket-system', ...(options.tools ?? [])],
      temperature: 0.4,
    },
  ];

  if (options.includeSpecialist !== false) {
    agents.push({
      name: 'specialist',
      role: {
        ...specialistRole,
        systemPrompt: specialistRole.systemPrompt + contextAddition,
      },
      model: options.model ?? 'claude-opus-4-8',
      provider: options.provider ?? 'anthropic',
      tools: [
        'diagnostic-tools',
        'system-logs',
        'knowledge-base',
        ...(options.tools ?? []),
      ],
      temperature: 0.2,
    });
  }

  if (options.includeEscalation !== false) {
    agents.push({
      name: 'escalation-manager',
      role: {
        ...escalationManagerRole,
        systemPrompt: escalationManagerRole.systemPrompt + contextAddition,
      },
      model: options.model ?? 'claude-opus-4-8',
      provider: options.provider ?? 'anthropic',
      tools: [
        'crm',
        'escalation-system',
        'customer-history',
        ...(options.tools ?? []),
      ],
      temperature: 0.3,
    });
  }

  return {
    name: options.name ?? 'customer-support-crew',
    description:
      'A customer support crew for handling customer inquiries and issues',
    agents,
    delegationStrategy: 'hierarchical',
    maxIterations: 15,
  };
}

/**
 * Create a customer support crew
 */
export function createCustomerSupportCrew(
  options: CustomerSupportCrewOptions = {},
): Crew {
  const config = createCustomerSupportCrewConfig(options);
  return createCrew(config);
}

/**
 * Customer support task templates
 */
export const CustomerSupportTasks = {
  /**
   * Create a support ticket task
   */
  handleTicket(
    customerMessage: string,
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal',
    customerTier?: string,
  ): TaskConfig {
    return {
      description: `Handle customer support request:\n\n${customerMessage}`,
      expectedOutput:
        'Resolution or escalation with clear next steps for the customer',
      priority:
        priority === 'urgent'
          ? 'critical'
          : priority === 'normal'
            ? 'medium'
            : priority,
      requiredCapabilities: ['issue-triage', 'empathetic-communication'],
      context: { customerTier, priority },
    };
  },

  /**
   * Create a technical issue task
   */
  resolveTechnicalIssue(
    issueDescription: string,
    errorLogs?: string,
    environment?: string,
  ): TaskConfig {
    return {
      description: `Resolve technical issue:\n\n${issueDescription}`,
      expectedOutput: 'Root cause identified and solution provided',
      priority: 'high',
      requiredCapabilities: ['advanced-troubleshooting', 'root-cause-analysis'],
      context: { errorLogs, environment },
    };
  },

  /**
   * Create an escalation task
   */
  handleEscalation(
    caseHistory: string,
    customerSentiment: 'frustrated' | 'angry' | 'neutral' = 'frustrated',
    businessImpact?: string,
  ): TaskConfig {
    return {
      description: `Handle escalated case:\n\n${caseHistory}`,
      expectedOutput:
        'Resolution plan with customer communication and follow-up actions',
      priority: 'critical',
      requiredCapabilities: ['crisis-management', 'conflict-resolution'],
      context: { customerSentiment, businessImpact },
    };
  },

  /**
   * Create a feedback response task
   */
  respondToFeedback(
    feedback: string,
    sentiment: 'positive' | 'neutral' | 'negative',
  ): TaskConfig {
    return {
      description: `Respond to customer feedback:\n\n${feedback}`,
      expectedOutput:
        'Appropriate response acknowledging feedback and any follow-up actions',
      priority: sentiment === 'negative' ? 'high' : 'medium',
      requiredCapabilities: ['empathetic-communication'],
      context: { sentiment },
    };
  },

  /**
   * Create a knowledge base task
   */
  createKnowledgeBaseArticle(topic: string, resolution: string): TaskConfig {
    return {
      description: `Create knowledge base article:\n\nTopic: ${topic}\nResolution: ${resolution}`,
      expectedOutput:
        'Well-structured knowledge base article for customer self-service',
      priority: 'low',
      requiredCapabilities: ['knowledge-base-search'],
      context: {},
    };
  },
};

export default createCustomerSupportCrew;
