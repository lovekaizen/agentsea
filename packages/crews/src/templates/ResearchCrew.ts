/**
 * Research Crew Template
 *
 * Pre-built crew for research tasks with researcher, analyst, and writer agents.
 */

import type {
  CrewConfig,
  CrewAgentConfig,
  RoleConfig,
  TaskConfig,
} from '../types';
import { Crew, createCrew } from '../core';

/**
 * Research crew options
 */
export interface ResearchCrewOptions {
  /** Crew name */
  name?: string;
  /** Model to use for agents */
  model?: string;
  /** LLM provider */
  provider?: string;
  /** Include writer agent */
  includeWriter?: boolean;
  /** Research depth */
  depth?: 'shallow' | 'standard' | 'deep';
  /** Additional tools */
  tools?: string[];
}

/**
 * Researcher role configuration
 */
const researcherRole: RoleConfig = {
  name: 'Researcher',
  description:
    'Expert at finding, gathering, and synthesizing information from various sources. ' +
    'Skilled at web research, document analysis, and data collection.',
  capabilities: [
    {
      name: 'web-search',
      description: 'Search the web for information',
      proficiency: 'expert',
    },
    {
      name: 'document-analysis',
      description: 'Analyze documents and extract key information',
      proficiency: 'expert',
    },
    {
      name: 'data-collection',
      description: 'Collect and organize data',
      proficiency: 'expert',
    },
    {
      name: 'fact-checking',
      description: 'Verify facts and sources',
      proficiency: 'expert',
    },
  ],
  systemPrompt: `You are an expert researcher with deep expertise in finding and synthesizing information.

Your approach:
1. Start by understanding the research question thoroughly
2. Identify the key concepts and terms to search for
3. Search multiple sources for comprehensive coverage
4. Cross-reference findings to ensure accuracy
5. Document sources and citations properly

Always cite your sources and indicate confidence levels in your findings.`,
  goals: [
    'Find accurate and relevant information',
    'Cover multiple perspectives on the topic',
    'Verify facts from multiple sources',
    'Document all sources properly',
  ],
  constraints: [
    'Only use credible sources',
    'Clearly distinguish between facts and opinions',
    'Acknowledge gaps in available information',
  ],
};

/**
 * Analyst role configuration
 */
const analystRole: RoleConfig = {
  name: 'Analyst',
  description:
    'Expert at analyzing data, identifying patterns, and deriving insights. ' +
    'Skilled at critical thinking, statistical analysis, and strategic assessment.',
  capabilities: [
    {
      name: 'data-analysis',
      description: 'Analyze data and identify patterns',
      proficiency: 'expert',
    },
    {
      name: 'critical-thinking',
      description: 'Apply critical thinking to problems',
      proficiency: 'expert',
    },
    {
      name: 'pattern-recognition',
      description: 'Identify patterns and trends',
      proficiency: 'expert',
    },
    {
      name: 'synthesis',
      description: 'Synthesize information from multiple sources',
      proficiency: 'expert',
    },
  ],
  systemPrompt: `You are an expert analyst skilled at deriving insights from information.

Your approach:
1. Review all gathered information thoroughly
2. Identify key patterns, themes, and relationships
3. Assess the significance of different findings
4. Draw logical conclusions based on evidence
5. Identify limitations and areas of uncertainty

Provide clear, actionable insights with supporting evidence.`,
  goals: [
    'Derive meaningful insights from data',
    'Identify key patterns and trends',
    'Provide actionable recommendations',
    'Quantify findings where possible',
  ],
  constraints: [
    'Support conclusions with evidence',
    'Acknowledge limitations and biases',
    'Distinguish correlation from causation',
  ],
};

/**
 * Writer role configuration
 */
const writerRole: RoleConfig = {
  name: 'Writer',
  description:
    'Expert at creating clear, compelling, and well-structured content. ' +
    'Skilled at technical writing, storytelling, and adapting tone for different audiences.',
  capabilities: [
    {
      name: 'technical-writing',
      description: 'Write clear technical content',
      proficiency: 'expert',
    },
    {
      name: 'report-generation',
      description: 'Generate comprehensive reports',
      proficiency: 'expert',
    },
    {
      name: 'content-structuring',
      description: 'Structure content logically',
      proficiency: 'expert',
    },
    {
      name: 'editing',
      description: 'Edit and refine written content',
      proficiency: 'expert',
    },
  ],
  systemPrompt: `You are an expert writer skilled at creating clear, compelling content.

Your approach:
1. Understand the target audience and purpose
2. Structure the content logically
3. Write clear, concise prose
4. Use appropriate tone and style
5. Include relevant examples and visuals

Create content that is both informative and engaging.`,
  goals: [
    'Create clear and well-structured content',
    'Adapt writing style to audience',
    'Ensure accuracy and completeness',
    'Make complex topics accessible',
  ],
  constraints: [
    'Maintain factual accuracy',
    'Cite sources appropriately',
    'Follow style guidelines',
  ],
};

/**
 * Create research crew configuration
 */
export function createResearchCrewConfig(
  options: ResearchCrewOptions = {},
): CrewConfig {
  const agents: CrewAgentConfig[] = [
    {
      name: 'researcher',
      role: researcherRole,
      model: options.model ?? 'claude-sonnet-4-20250514',
      provider: options.provider ?? 'anthropic',
      tools: ['web-search', 'read-document', ...(options.tools ?? [])],
      temperature: 0.3,
    },
    {
      name: 'analyst',
      role: analystRole,
      model: options.model ?? 'claude-sonnet-4-20250514',
      provider: options.provider ?? 'anthropic',
      tools: ['calculator', 'data-analysis', ...(options.tools ?? [])],
      temperature: 0.2,
    },
  ];

  if (options.includeWriter !== false) {
    agents.push({
      name: 'writer',
      role: writerRole,
      model: options.model ?? 'claude-sonnet-4-20250514',
      provider: options.provider ?? 'anthropic',
      tools: ['text-editor', ...(options.tools ?? [])],
      temperature: 0.5,
    });
  }

  return {
    name: options.name ?? 'research-crew',
    description:
      'A research crew for comprehensive information gathering and analysis',
    agents,
    delegationStrategy: 'hierarchical',
    maxIterations:
      options.depth === 'deep' ? 50 : options.depth === 'shallow' ? 10 : 25,
  };
}

/**
 * Create a research crew
 */
export function createResearchCrew(options: ResearchCrewOptions = {}): Crew {
  const config = createResearchCrewConfig(options);
  return createCrew(config);
}

/**
 * Research task templates
 */
export const ResearchTasks = {
  /**
   * Create a research task
   */
  research(
    topic: string,
    depth: 'shallow' | 'standard' | 'deep' = 'standard',
  ): TaskConfig {
    return {
      description: `Research the topic: ${topic}`,
      expectedOutput:
        'Comprehensive research findings with sources and citations',
      priority: depth === 'deep' ? 'high' : 'medium',
      requiredCapabilities: ['web-search', 'document-analysis'],
      context: { depth },
    };
  },

  /**
   * Create an analysis task
   */
  analyze(data: string, focusAreas?: string[]): TaskConfig {
    return {
      description: `Analyze the following data and provide insights: ${data}`,
      expectedOutput:
        'Analysis report with key findings, patterns, and recommendations',
      priority: 'high',
      requiredCapabilities: ['data-analysis', 'critical-thinking'],
      context: { focusAreas },
    };
  },

  /**
   * Create a report writing task
   */
  writeReport(
    topic: string,
    format: 'summary' | 'detailed' | 'executive' = 'detailed',
  ): TaskConfig {
    return {
      description: `Write a ${format} report on: ${topic}`,
      expectedOutput: `A well-structured ${format} report with clear sections and conclusions`,
      priority: 'medium',
      requiredCapabilities: ['technical-writing', 'report-generation'],
      context: { format },
    };
  },
};

export default createResearchCrew;
