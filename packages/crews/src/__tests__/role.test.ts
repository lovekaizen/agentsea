import { describe, it, expect } from 'vitest';
import { Role, createRole } from '../core/Role.js';
import type {
  RoleConfig,
  Capability,
  ProficiencyLevel,
} from '../types/index.js';

// Helper to create a capability
function createCapability(overrides: Partial<Capability> = {}): Capability {
  return {
    name: 'coding',
    description: 'Writing code',
    proficiency: 'intermediate',
    ...overrides,
  };
}

// Helper to create a role config
function createRoleConfig(overrides: Partial<RoleConfig> = {}): RoleConfig {
  return {
    name: 'Developer',
    description: 'A software developer',
    capabilities: [createCapability()],
    systemPrompt: 'You are a helpful developer.',
    ...overrides,
  };
}

describe('Role', () => {
  describe('constructor', () => {
    it('should create a role with required fields', () => {
      const role = new Role(createRoleConfig());

      expect(role.name).toBe('Developer');
      expect(role.description).toBe('A software developer');
      expect(role.systemPrompt).toBe('You are a helpful developer.');
      expect(role.capabilities).toHaveLength(1);
    });

    it('should default optional fields', () => {
      const role = new Role(createRoleConfig());

      expect(role.goals).toEqual([]);
      expect(role.constraints).toEqual([]);
      expect(role.backstory).toBe('');
      expect(role.canDelegate).toBe(false);
      expect(role.canReceiveDelegation).toBe(true);
      expect(role.maxConcurrentTasks).toBe(1);
    });

    it('should accept custom goals', () => {
      const role = new Role(
        createRoleConfig({
          goals: ['Write clean code', 'Fix bugs'],
        }),
      );

      expect(role.goals).toEqual(['Write clean code', 'Fix bugs']);
    });

    it('should accept custom constraints', () => {
      const role = new Role(
        createRoleConfig({
          constraints: ['Follow coding standards', 'Write tests'],
        }),
      );

      expect(role.constraints).toEqual([
        'Follow coding standards',
        'Write tests',
      ]);
    });

    it('should accept backstory', () => {
      const role = new Role(
        createRoleConfig({
          backstory: 'A senior developer with 10 years of experience.',
        }),
      );

      expect(role.backstory).toBe(
        'A senior developer with 10 years of experience.',
      );
    });

    it('should accept delegation settings', () => {
      const role = new Role(
        createRoleConfig({
          canDelegate: true,
          canReceiveDelegation: false,
        }),
      );

      expect(role.canDelegate).toBe(true);
      expect(role.canReceiveDelegation).toBe(false);
    });

    it('should accept custom maxConcurrentTasks', () => {
      const role = new Role(
        createRoleConfig({
          maxConcurrentTasks: 5,
        }),
      );

      expect(role.maxConcurrentTasks).toBe(5);
    });

    it('should build capability map with lowercase keys', () => {
      const role = new Role(
        createRoleConfig({
          capabilities: [
            createCapability({ name: 'JavaScript' }),
            createCapability({ name: 'TypeScript' }),
          ],
        }),
      );

      expect(role.hasCapability('javascript')).toBe(true);
      expect(role.hasCapability('JAVASCRIPT')).toBe(true);
    });
  });

  describe('generateSystemPrompt', () => {
    it('should include base system prompt', () => {
      const role = new Role(createRoleConfig());
      const prompt = role.generateSystemPrompt();

      expect(prompt).toContain('You are a helpful developer.');
    });

    it('should include role context', () => {
      const role = new Role(createRoleConfig());
      const prompt = role.generateSystemPrompt();

      expect(prompt).toContain('You are acting as a Developer');
      expect(prompt).toContain('A software developer');
    });

    it('should include backstory when provided', () => {
      const role = new Role(
        createRoleConfig({
          backstory: 'Has extensive experience in AI.',
        }),
      );
      const prompt = role.generateSystemPrompt();

      expect(prompt).toContain('Background: Has extensive experience in AI.');
    });

    it('should include goals when provided', () => {
      const role = new Role(
        createRoleConfig({
          goals: ['Write efficient code', 'Help the team'],
        }),
      );
      const prompt = role.generateSystemPrompt();

      expect(prompt).toContain('Your goals:');
      expect(prompt).toContain('- Write efficient code');
      expect(prompt).toContain('- Help the team');
    });

    it('should include constraints when provided', () => {
      const role = new Role(
        createRoleConfig({
          constraints: ['Be concise', 'Follow best practices'],
        }),
      );
      const prompt = role.generateSystemPrompt();

      expect(prompt).toContain('Constraints you must respect:');
      expect(prompt).toContain('- Be concise');
      expect(prompt).toContain('- Follow best practices');
    });

    it('should include capabilities', () => {
      const role = new Role(
        createRoleConfig({
          capabilities: [
            createCapability({ name: 'coding', proficiency: 'expert' }),
          ],
        }),
      );
      const prompt = role.generateSystemPrompt();

      expect(prompt).toContain('Your capabilities:');
      expect(prompt).toContain('coding (expert)');
    });
  });

  describe('hasCapability', () => {
    const role = new Role(
      createRoleConfig({
        capabilities: [
          createCapability({ name: 'coding' }),
          createCapability({ name: 'testing' }),
        ],
      }),
    );

    it('should return true for existing capability', () => {
      expect(role.hasCapability('coding')).toBe(true);
    });

    it('should return false for non-existing capability', () => {
      expect(role.hasCapability('design')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(role.hasCapability('CODING')).toBe(true);
      expect(role.hasCapability('Coding')).toBe(true);
    });
  });

  describe('getCapability', () => {
    const role = new Role(
      createRoleConfig({
        capabilities: [
          createCapability({ name: 'coding', description: 'Writing code' }),
        ],
      }),
    );

    it('should return capability by name', () => {
      const cap = role.getCapability('coding');
      expect(cap?.name).toBe('coding');
      expect(cap?.description).toBe('Writing code');
    });

    it('should return undefined for non-existing capability', () => {
      expect(role.getCapability('design')).toBeUndefined();
    });

    it('should be case-insensitive', () => {
      expect(role.getCapability('CODING')).toBeDefined();
    });
  });

  describe('getProficiency', () => {
    const role = new Role(
      createRoleConfig({
        capabilities: [
          createCapability({ name: 'coding', proficiency: 'expert' }),
        ],
      }),
    );

    it('should return proficiency level', () => {
      expect(role.getProficiency('coding')).toBe('expert');
    });

    it('should return undefined for non-existing capability', () => {
      expect(role.getProficiency('design')).toBeUndefined();
    });
  });

  describe('getProficiencyScore', () => {
    it('should return correct scores for each level', () => {
      const novice = new Role(
        createRoleConfig({
          capabilities: [
            createCapability({ name: 'skill', proficiency: 'novice' }),
          ],
        }),
      );
      const intermediate = new Role(
        createRoleConfig({
          capabilities: [
            createCapability({ name: 'skill', proficiency: 'intermediate' }),
          ],
        }),
      );
      const expert = new Role(
        createRoleConfig({
          capabilities: [
            createCapability({ name: 'skill', proficiency: 'expert' }),
          ],
        }),
      );
      const master = new Role(
        createRoleConfig({
          capabilities: [
            createCapability({ name: 'skill', proficiency: 'master' }),
          ],
        }),
      );

      expect(novice.getProficiencyScore('skill')).toBe(0.25);
      expect(intermediate.getProficiencyScore('skill')).toBe(0.5);
      expect(expert.getProficiencyScore('skill')).toBe(0.75);
      expect(master.getProficiencyScore('skill')).toBe(1.0);
    });

    it('should return 0 for non-existing capability', () => {
      const role = new Role(createRoleConfig());
      expect(role.getProficiencyScore('non-existent')).toBe(0);
    });
  });

  describe('getRequiredTools', () => {
    it('should return all unique tools from capabilities', () => {
      const role = new Role(
        createRoleConfig({
          capabilities: [
            createCapability({ name: 'coding', tools: ['editor', 'git'] }),
            createCapability({ name: 'testing', tools: ['jest', 'git'] }),
          ],
        }),
      );

      const tools = role.getRequiredTools();
      expect(tools).toContain('editor');
      expect(tools).toContain('git');
      expect(tools).toContain('jest');
      expect(tools).toHaveLength(3); // git should not be duplicated
    });

    it('should return empty array when no tools defined', () => {
      const role = new Role(
        createRoleConfig({
          capabilities: [createCapability({ tools: undefined })],
        }),
      );

      expect(role.getRequiredTools()).toEqual([]);
    });
  });

  describe('getKeywords', () => {
    it('should return all unique keywords in lowercase', () => {
      const role = new Role(
        createRoleConfig({
          capabilities: [
            createCapability({
              name: 'coding',
              keywords: ['JavaScript', 'TypeScript'],
            }),
            createCapability({
              name: 'testing',
              keywords: ['Jest', 'TypeScript'],
            }),
          ],
        }),
      );

      const keywords = role.getKeywords();
      expect(keywords).toContain('javascript');
      expect(keywords).toContain('typescript');
      expect(keywords).toContain('jest');
      expect(keywords).toHaveLength(3);
    });

    it('should return empty array when no keywords defined', () => {
      const role = new Role(
        createRoleConfig({
          capabilities: [createCapability({ keywords: undefined })],
        }),
      );

      expect(role.getKeywords()).toEqual([]);
    });
  });

  describe('matchCapabilities', () => {
    const role = new Role(
      createRoleConfig({
        capabilities: [
          createCapability({ name: 'coding' }),
          createCapability({ name: 'testing' }),
        ],
      }),
    );

    it('should return full match when all capabilities present', () => {
      const required = [
        createCapability({ name: 'coding' }),
        createCapability({ name: 'testing' }),
      ];

      const match = role.matchCapabilities(required);

      expect(match.matched).toHaveLength(2);
      expect(match.missing).toHaveLength(0);
      expect(match.score).toBe(1);
      expect(match.canExecute).toBe(true);
    });

    it('should return partial match when some capabilities missing', () => {
      const required = [
        createCapability({ name: 'coding' }),
        createCapability({ name: 'design' }),
      ];

      const match = role.matchCapabilities(required);

      expect(match.matched).toHaveLength(1);
      expect(match.missing).toHaveLength(1);
      expect(match.score).toBe(0.5);
      expect(match.canExecute).toBe(false);
    });

    it('should return no match when all capabilities missing', () => {
      const required = [
        createCapability({ name: 'design' }),
        createCapability({ name: 'marketing' }),
      ];

      const match = role.matchCapabilities(required);

      expect(match.matched).toHaveLength(0);
      expect(match.missing).toHaveLength(2);
      expect(match.score).toBe(0);
      expect(match.canExecute).toBe(false);
    });

    it('should return score of 1 when no capabilities required', () => {
      const match = role.matchCapabilities([]);
      expect(match.score).toBe(1);
      expect(match.canExecute).toBe(true);
    });
  });

  describe('calculateRelevanceScore', () => {
    it('should match based on keywords', () => {
      const role = new Role(
        createRoleConfig({
          capabilities: [
            createCapability({
              name: 'coding',
              keywords: ['javascript', 'react', 'typescript'],
            }),
          ],
        }),
      );

      const score = role.calculateRelevanceScore(
        'Build a React component with TypeScript',
      );
      expect(score).toBeGreaterThan(0);
    });

    it('should return 0 for no keyword matches', () => {
      const role = new Role(
        createRoleConfig({
          capabilities: [
            createCapability({
              name: 'coding',
              keywords: ['python', 'django'],
            }),
          ],
        }),
      );

      const score = role.calculateRelevanceScore('Build a React component');
      expect(score).toBe(0);
    });

    it('should fall back to capability names when no keywords', () => {
      const role = new Role(
        createRoleConfig({
          capabilities: [
            createCapability({ name: 'coding', keywords: undefined }),
            createCapability({ name: 'testing', keywords: undefined }),
          ],
        }),
      );

      const score = role.calculateRelevanceScore('I need help with coding');
      expect(score).toBeGreaterThan(0);
    });

    it('should be case-insensitive', () => {
      const role = new Role(
        createRoleConfig({
          capabilities: [createCapability({ keywords: ['javascript'] })],
        }),
      );

      const score1 = role.calculateRelevanceScore('JavaScript development');
      const score2 = role.calculateRelevanceScore('JAVASCRIPT development');

      expect(score1).toBe(score2);
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON', () => {
      const role = new Role(
        createRoleConfig({
          goals: ['Goal 1'],
          constraints: ['Constraint 1'],
          backstory: 'A story',
        }),
      );

      const json = role.toJSON();

      expect(json.name).toBe('Developer');
      expect(json.description).toBe('A software developer');
      expect(json.goals).toEqual(['Goal 1']);
      expect(json.constraints).toEqual(['Constraint 1']);
      expect(json.backstory).toBe('A story');
    });

    it('should omit empty optional fields in JSON', () => {
      const role = new Role(createRoleConfig());
      const json = role.toJSON();

      expect(json.goals).toBeUndefined();
      expect(json.constraints).toBeUndefined();
      expect(json.backstory).toBeUndefined();
    });

    it('should create from JSON', () => {
      const config = createRoleConfig({
        goals: ['Goal 1'],
      });
      const role = Role.fromJSON(config);

      expect(role.name).toBe('Developer');
      expect(role.goals).toEqual(['Goal 1']);
    });
  });

  describe('static simple', () => {
    it('should create a simple role with minimal config', () => {
      const role = Role.simple(
        'Helper',
        'A helpful assistant',
        'You are helpful.',
        ['coding', 'testing'],
      );

      expect(role.name).toBe('Helper');
      expect(role.description).toBe('A helpful assistant');
      expect(role.systemPrompt).toBe('You are helpful.');
      expect(role.capabilities).toHaveLength(2);
      expect(role.hasCapability('coding')).toBe(true);
    });

    it('should default capabilities to intermediate proficiency', () => {
      const role = Role.simple('Helper', 'desc', 'prompt', ['coding']);
      expect(role.getProficiency('coding')).toBe('intermediate');
    });

    it('should work with no capabilities', () => {
      const role = Role.simple('Helper', 'desc', 'prompt');
      expect(role.capabilities).toHaveLength(0);
    });
  });

  describe('createRole factory', () => {
    it('should create a role instance', () => {
      const role = createRole(createRoleConfig());
      expect(role).toBeInstanceOf(Role);
    });
  });
});
