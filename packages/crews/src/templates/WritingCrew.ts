/**
 * Writing Crew Template
 *
 * Pre-built crew for content creation with editor, writer, and proofreader agents.
 */

import type {
  CrewConfig,
  CrewAgentConfig,
  RoleConfig,
  TaskConfig,
} from '../types';
import { Crew, createCrew } from '../core';

/**
 * Writing crew options
 */
export interface WritingCrewOptions {
  /** Crew name */
  name?: string;
  /** Model to use for agents */
  model?: string;
  /** LLM provider */
  provider?: string;
  /** Content type specialization */
  contentType?: 'blog' | 'technical' | 'marketing' | 'creative' | 'general';
  /** Target audience */
  audience?: string;
  /** Additional tools */
  tools?: string[];
}

/**
 * Editor role configuration
 */
const editorRole: RoleConfig = {
  name: 'Editor',
  description:
    'Expert at reviewing, structuring, and improving written content. ' +
    'Skilled at content strategy, structural editing, and quality assurance.',
  capabilities: [
    {
      name: 'content-review',
      description: 'Review and evaluate content quality',
      proficiency: 'expert',
    },
    {
      name: 'structural-editing',
      description: 'Improve content structure and flow',
      proficiency: 'expert',
    },
    {
      name: 'style-guidance',
      description: 'Provide style and tone guidance',
      proficiency: 'expert',
    },
    {
      name: 'quality-assurance',
      description: 'Ensure content meets quality standards',
      proficiency: 'expert',
    },
  ],
  systemPrompt: `You are a senior editor with expertise in content quality and structure.

Your approach:
1. Review content for clarity, coherence, and completeness
2. Assess structure and logical flow
3. Evaluate tone and style consistency
4. Identify areas for improvement
5. Provide constructive, actionable feedback

Focus on making content more effective for its intended audience.`,
  goals: [
    'Ensure content quality and coherence',
    'Improve structure and readability',
    'Maintain consistent style and tone',
    'Guide writers to produce better content',
  ],
  constraints: [
    "Preserve the author's voice",
    'Provide specific, actionable feedback',
    'Balance quality with deadlines',
  ],
};

/**
 * Writer role configuration
 */
const writerRole: RoleConfig = {
  name: 'Writer',
  description:
    'Expert at creating engaging, well-crafted content across various formats. ' +
    'Skilled at research, storytelling, and adapting writing style.',
  capabilities: [
    {
      name: 'content-creation',
      description: 'Create original content',
      proficiency: 'expert',
    },
    {
      name: 'storytelling',
      description: 'Craft engaging narratives',
      proficiency: 'expert',
    },
    {
      name: 'research-writing',
      description: 'Write research-based content',
      proficiency: 'expert',
    },
    {
      name: 'SEO-writing',
      description: 'Write SEO-optimized content',
      proficiency: 'intermediate',
    },
  ],
  systemPrompt: `You are a skilled content writer capable of creating engaging content.

Your approach:
1. Understand the topic and audience thoroughly
2. Research and gather relevant information
3. Create an outline before writing
4. Write clear, engaging prose
5. Revise and polish your work

Strive to inform, engage, and inspire your readers.`,
  goals: [
    'Create engaging and informative content',
    'Meet the needs of the target audience',
    'Maintain high quality standards',
    'Deliver content on time',
  ],
  constraints: [
    'Follow style guidelines',
    'Cite sources when appropriate',
    'Stay on topic and within scope',
  ],
};

/**
 * Proofreader role configuration
 */
const proofreaderRole: RoleConfig = {
  name: 'Proofreader',
  description:
    'Expert at finding and correcting errors in written content. ' +
    'Skilled at grammar, spelling, punctuation, and consistency checking.',
  capabilities: [
    {
      name: 'grammar-checking',
      description: 'Check and correct grammar',
      proficiency: 'expert',
    },
    {
      name: 'spelling-correction',
      description: 'Find and fix spelling errors',
      proficiency: 'expert',
    },
    {
      name: 'punctuation-review',
      description: 'Review and correct punctuation',
      proficiency: 'expert',
    },
    {
      name: 'consistency-checking',
      description: 'Ensure consistency throughout',
      proficiency: 'expert',
    },
  ],
  systemPrompt: `You are an expert proofreader with an exceptional eye for detail.

Your approach:
1. Read content multiple times for different error types
2. Check grammar, spelling, and punctuation
3. Verify consistency in style and formatting
4. Look for typos and minor errors
5. Provide clear corrections

Leave no error uncaught.`,
  goals: [
    'Eliminate all errors in content',
    'Ensure consistency throughout',
    'Maintain style guide compliance',
    'Deliver polished, professional content',
  ],
  constraints: [
    "Don't change meaning or style unnecessarily",
    'Focus on errors, not preferences',
    'Document all changes made',
  ],
};

/**
 * Create writing crew configuration
 */
export function createWritingCrewConfig(
  options: WritingCrewOptions = {},
): CrewConfig {
  const contentTypePrompt = options.contentType
    ? `\n\nYou specialize in ${options.contentType} content.`
    : '';

  const audiencePrompt = options.audience
    ? `\n\nYour target audience is: ${options.audience}`
    : '';

  const agents: CrewAgentConfig[] = [
    {
      name: 'editor',
      role: {
        ...editorRole,
        systemPrompt:
          editorRole.systemPrompt + contentTypePrompt + audiencePrompt,
      },
      model: options.model ?? 'claude-opus-4-8',
      provider: options.provider ?? 'anthropic',
      tools: ['text-editor', ...(options.tools ?? [])],
      temperature: 0.3,
    },
    {
      name: 'writer',
      role: {
        ...writerRole,
        systemPrompt:
          writerRole.systemPrompt + contentTypePrompt + audiencePrompt,
      },
      model: options.model ?? 'claude-opus-4-8',
      provider: options.provider ?? 'anthropic',
      tools: ['web-search', 'text-editor', ...(options.tools ?? [])],
      temperature: 0.7,
    },
    {
      name: 'proofreader',
      role: proofreaderRole,
      model: options.model ?? 'claude-opus-4-8',
      provider: options.provider ?? 'anthropic',
      tools: ['grammar-checker', 'spell-checker', ...(options.tools ?? [])],
      temperature: 0.1,
    },
  ];

  return {
    name: options.name ?? 'writing-crew',
    description: 'A writing crew for content creation and editing',
    agents,
    delegationStrategy: 'hierarchical',
    maxIterations: 30,
  };
}

/**
 * Create a writing crew
 */
export function createWritingCrew(options: WritingCrewOptions = {}): Crew {
  const config = createWritingCrewConfig(options);
  return createCrew(config);
}

/**
 * Writing task templates
 */
export const WritingTasks = {
  /**
   * Create a draft writing task
   */
  draft(topic: string, wordCount?: number, style?: string): TaskConfig {
    return {
      description: `Write a draft about: ${topic}${wordCount ? ` (approximately ${wordCount} words)` : ''}`,
      expectedOutput: `A well-written draft${style ? ` in ${style} style` : ''} covering the topic comprehensively`,
      priority: 'high',
      requiredCapabilities: ['content-creation'],
      context: { wordCount, style },
    };
  },

  /**
   * Create an editing task
   */
  edit(content: string, focusAreas?: string[]): TaskConfig {
    return {
      description: `Edit the following content for quality and clarity:\n\n${content.substring(0, 200)}...`,
      expectedOutput:
        'Edited content with improvements to structure, clarity, and flow',
      priority: 'high',
      requiredCapabilities: ['content-review', 'structural-editing'],
      context: { focusAreas, fullContent: content },
    };
  },

  /**
   * Create a proofreading task
   */
  proofread(content: string): TaskConfig {
    return {
      description: `Proofread the following content:\n\n${content.substring(0, 200)}...`,
      expectedOutput:
        'Corrected content with all errors fixed and changes documented',
      priority: 'medium',
      requiredCapabilities: ['grammar-checking', 'spelling-correction'],
      context: { fullContent: content },
    };
  },

  /**
   * Create a blog post task
   */
  blogPost(topic: string, keywords?: string[]): TaskConfig {
    return {
      description: `Write a blog post about: ${topic}`,
      expectedOutput:
        'An engaging blog post with introduction, body sections, and conclusion',
      priority: 'high',
      requiredCapabilities: ['content-creation', 'SEO-writing'],
      context: { keywords },
    };
  },

  /**
   * Create a technical documentation task
   */
  technicalDoc(
    subject: string,
    audience: 'beginner' | 'intermediate' | 'advanced' = 'intermediate',
  ): TaskConfig {
    return {
      description: `Write technical documentation for: ${subject}`,
      expectedOutput: `Clear technical documentation suitable for ${audience} level users`,
      priority: 'high',
      requiredCapabilities: ['research-writing'],
      context: { audience },
    };
  },
};

export default createWritingCrew;
