/**
 * Prompt Registry
 *
 * Main orchestrator for prompt management, versioning, and collaboration.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  RegistryConfig,
  RegistryEvent,
  RegistryEventType,
  RegistryStats,
  PartialDefinition,
  StorageAdapter,
  CreatePromptInput,
  UpdatePromptInput,
  PromptData,
  PromptQueryOptions,
  RenderOptions,
  RenderedPrompt,
  DiffOptions,
  DiffResult,
  CreateBranchInput,
  BranchInfo,
  MergeOptions,
  MergeResult,
  RollbackOptions,
  RollbackResult,
  EnvironmentConfig,
  PromoteInput,
  PromotionResult,
  ABTestConfig,
  ABTestData,
  CreateReviewInput,
  ReviewRequest,
  AuditLogEntry,
  AuditLogQueryOptions,
  AuditAction,
} from '../types/index.js';
import { Prompt } from './Prompt.js';
import { PromptVersion, VersionHistory } from './PromptVersion.js';
import { Partial } from './PromptTemplate.js';
import { generateId, incrementVersion, hashContent } from '../utils/hashing.js';
import { normalizeTemplate } from '../utils/formatting.js';

/**
 * Cache entry
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Simple in-memory cache
 */
class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private ttl: number;

  constructor(options: { maxSize?: number; ttl?: number } = {}) {
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || 300; // 5 minutes default
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttl * 1000,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Main PromptRegistry class
 */
export class PromptRegistry extends EventEmitter<
  Record<RegistryEventType, [RegistryEvent]>
> {
  private storage: StorageAdapter;
  private defaultEnvironment: string;
  private environments: Map<string, EnvironmentConfig>;
  private cache?: SimpleCache<PromptData>;
  private versionHistories: Map<string, VersionHistory> = new Map();
  private partials: Map<string, Partial> = new Map();
  private initialized = false;

  constructor(config: RegistryConfig) {
    super();
    this.storage = config.storage;
    this.defaultEnvironment = config.defaultEnvironment || 'development';
    this.environments = new Map();

    // Set up default environments
    const defaultEnvs: EnvironmentConfig[] = config.environments || [
      { name: 'development', label: 'Dev', order: 1 },
      { name: 'staging', label: 'Staging', order: 2 },
      { name: 'production', label: 'Prod', protected: true, order: 3 },
    ];

    for (const env of defaultEnvs) {
      this.environments.set(env.name, env);
    }

    // Set up caching
    if (config.caching?.enabled !== false) {
      this.cache = new SimpleCache({
        maxSize: config.caching?.maxSize,
        ttl: config.caching?.ttl,
      });
    }
  }

  /**
   * Initialize the registry
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.storage.initialize();

    // Load partials
    const partials = await this.storage.getAllPartials();
    for (const [name, template] of Object.entries(partials)) {
      this.partials.set(name, new Partial({ name, template }));
    }

    this.initialized = true;
  }

  /**
   * Ensure registry is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // ==================== Prompt CRUD Operations ====================

  /**
   * Create a new prompt
   */
  async create(input: CreatePromptInput): Promise<Prompt> {
    await this.ensureInitialized();

    const environment = input.environment || this.defaultEnvironment;

    // Check if prompt with same name exists in environment
    const existing = await this.storage.getPromptByName(
      input.name,
      environment,
    );
    if (existing) {
      throw new Error(
        `Prompt '${input.name}' already exists in ${environment}`,
      );
    }

    // Create prompt
    const prompt = new Prompt({
      ...input,
      environment,
      version: 'v1',
      status: input.status || 'draft',
    });

    // Save prompt
    await this.storage.savePrompt(prompt.toData());

    // Create initial version
    const version = PromptVersion.fromPrompt(prompt.toData(), {
      message: 'Initial version',
    });
    await this.storage.saveVersion(version.toData());

    // Initialize version history
    this.versionHistories.set(prompt.id, new VersionHistory([version]));

    // Audit log
    await this.logAudit('create', 'prompt', prompt.id, prompt.name);

    // Emit event
    this.emit('prompt:created', {
      type: 'prompt:created',
      promptId: prompt.id,
      promptName: prompt.name,
      version: prompt.version,
      environment,
      timestamp: new Date(),
    });

    return prompt;
  }

  /**
   * Get a prompt by name
   */
  async get(
    name: string,
    options: { environment?: string; version?: string } = {},
  ): Promise<Prompt | null> {
    await this.ensureInitialized();

    const environment = options.environment || this.defaultEnvironment;
    const cacheKey = `${name}:${environment}:${options.version || 'latest'}`;

    // Check cache
    if (this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return Prompt.fromData(cached);
      }
    }

    // Get from storage
    let promptData: PromptData | null;

    if (options.version) {
      // Get specific version
      const data = await this.storage.getPromptByName(name, environment);
      if (!data) return null;

      const versionEntry = await this.storage.getVersion(
        data.id,
        options.version,
      );
      if (!versionEntry) return null;

      promptData = versionEntry.snapshot;
    } else {
      promptData = await this.storage.getPromptByName(name, environment);
    }

    if (!promptData) return null;

    // Cache result
    if (this.cache) {
      this.cache.set(cacheKey, promptData);
    }

    return Prompt.fromData(promptData);
  }

  /**
   * Get a prompt by ID
   */
  async getById(
    id: string,
    options: { environment?: string } = {},
  ): Promise<Prompt | null> {
    await this.ensureInitialized();

    const environment = options.environment || this.defaultEnvironment;
    const promptData = await this.storage.getPrompt(id, environment);

    if (!promptData) return null;

    return Prompt.fromData(promptData);
  }

  /**
   * Update a prompt (creates new version)
   */
  async update(
    name: string,
    updates: UpdatePromptInput,
    options: { environment?: string; author?: string } = {},
  ): Promise<Prompt> {
    await this.ensureInitialized();

    const environment = options.environment || this.defaultEnvironment;

    // Get existing prompt
    const existing = await this.get(name, { environment });
    if (!existing) {
      throw new Error(`Prompt '${name}' not found in ${environment}`);
    }

    // Check if template changed
    const templateChanged =
      updates.template &&
      normalizeTemplate(updates.template) !== existing.template;

    // Determine new version
    let newVersion = existing.version;
    if (templateChanged) {
      newVersion = incrementVersion(existing.version);
    }

    // Create updated prompt
    const updated = existing.update({
      ...updates,
    });

    // Update version if template changed
    const promptData: PromptData = {
      ...updated.toData(),
      version: newVersion,
      updatedAt: new Date(),
    };

    // Save prompt
    await this.storage.savePrompt(promptData);

    // Create version entry if template changed
    if (templateChanged) {
      const version = PromptVersion.fromPrompt(promptData, {
        message: updates.message || 'Updated prompt',
        author: options.author,
        parentVersion: existing.version,
      });
      await this.storage.saveVersion(version.toData());

      // Update version history
      const history = this.versionHistories.get(existing.id);
      if (history) {
        history.add(version);
      }
    }

    // Invalidate cache
    if (this.cache) {
      this.cache.invalidatePattern(`^${name}:${environment}`);
    }

    // Audit log
    await this.logAudit('update', 'prompt', existing.id, name, {
      changes: Object.keys(updates),
      newVersion,
    });

    // Emit event
    this.emit('prompt:updated', {
      type: 'prompt:updated',
      promptId: existing.id,
      promptName: name,
      version: newVersion,
      environment,
      timestamp: new Date(),
    });

    return Prompt.fromData(promptData);
  }

  /**
   * Delete a prompt
   */
  async delete(
    name: string,
    options: { environment?: string } = {},
  ): Promise<boolean> {
    await this.ensureInitialized();

    const environment = options.environment || this.defaultEnvironment;
    const existing = await this.get(name, { environment });

    if (!existing) {
      return false;
    }

    const success = await this.storage.deletePrompt(existing.id);

    if (success) {
      // Invalidate cache
      if (this.cache) {
        this.cache.invalidatePattern(`^${name}:`);
      }

      // Remove version history
      this.versionHistories.delete(existing.id);

      // Audit log
      await this.logAudit('delete', 'prompt', existing.id, name);

      // Emit event
      this.emit('prompt:deleted', {
        type: 'prompt:deleted',
        promptId: existing.id,
        promptName: name,
        environment,
        timestamp: new Date(),
      });
    }

    return success;
  }

  /**
   * Query prompts
   */
  async query(options: PromptQueryOptions = {}): Promise<Prompt[]> {
    await this.ensureInitialized();

    const queryOptions = {
      ...options,
      environment: options.environment || this.defaultEnvironment,
    };

    const prompts = await this.storage.queryPrompts(queryOptions);
    return prompts.map((data) => Prompt.fromData(data));
  }

  /**
   * List all prompts
   */
  async list(options: { environment?: string } = {}): Promise<Prompt[]> {
    return this.query({ environment: options.environment });
  }

  // ==================== Rendering ====================

  /**
   * Render a prompt with variables
   */
  async render(
    name: string,
    variables: Record<string, unknown>,
    options: RenderOptions & { environment?: string; version?: string } = {},
  ): Promise<RenderedPrompt> {
    const prompt = await this.get(name, {
      environment: options.environment,
      version: options.version,
    });

    if (!prompt) {
      throw new Error(`Prompt '${name}' not found`);
    }

    // Get partials
    const partials: Record<string, string> = options.partials || {};
    for (const [partialName, partial] of this.partials) {
      if (!(partialName in partials)) {
        partials[partialName] = partial.template;
      }
    }

    return prompt.render(variables, { ...options, partials });
  }

  // ==================== Version Control ====================

  /**
   * Get version history for a prompt
   */
  async history(
    name: string,
    options: { environment?: string; limit?: number } = {},
  ): Promise<PromptVersion[]> {
    await this.ensureInitialized();

    const prompt = await this.get(name, { environment: options.environment });
    if (!prompt) {
      throw new Error(`Prompt '${name}' not found`);
    }

    const versions = await this.storage.getVersionHistory(
      prompt.id,
      options.limit,
    );
    return versions.map((v) => new PromptVersion(v));
  }

  /**
   * Get diff between two versions
   */
  async diff(name: string, options: DiffOptions): Promise<DiffResult> {
    await this.ensureInitialized();

    const prompt = await this.get(name);
    if (!prompt) {
      throw new Error(`Prompt '${name}' not found`);
    }

    const fromVersion = await this.storage.getVersion(prompt.id, options.from);
    const toVersion = await this.storage.getVersion(prompt.id, options.to);

    if (!fromVersion || !toVersion) {
      throw new Error('One or both versions not found');
    }

    // Use diff library
    const { diffLines } = await import('diff');
    const changes = diffLines(
      fromVersion.snapshot.template,
      toVersion.snapshot.template,
      {
        ignoreWhitespace: options.ignoreWhitespace,
      },
    );

    let additions = 0;
    let deletions = 0;
    let unchanged = 0;

    const hunks: DiffResult['hunks'] = [];
    let currentHunk: DiffResult['hunks'][0] | null = null;
    let oldLine = 1;
    let newLine = 1;

    for (const change of changes) {
      const lines = (change.value.match(/\n/g) || []).length || 1;

      if (change.added) {
        additions += lines;
        if (!currentHunk) {
          currentHunk = {
            oldStart: oldLine,
            oldLines: 0,
            newStart: newLine,
            newLines: 0,
            lines: [],
          };
        }
        currentHunk.lines.push({
          type: 'added',
          content: change.value,
          newLineNumber: newLine,
        });
        currentHunk.newLines += lines;
        newLine += lines;
      } else if (change.removed) {
        deletions += lines;
        if (!currentHunk) {
          currentHunk = {
            oldStart: oldLine,
            oldLines: 0,
            newStart: newLine,
            newLines: 0,
            lines: [],
          };
        }
        currentHunk.lines.push({
          type: 'removed',
          content: change.value,
          oldLineNumber: oldLine,
        });
        currentHunk.oldLines += lines;
        oldLine += lines;
      } else {
        unchanged += lines;
        if (currentHunk) {
          hunks.push(currentHunk);
          currentHunk = null;
        }
        oldLine += lines;
        newLine += lines;
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    const total = additions + deletions + unchanged;
    const similarity = unchanged / total;

    return {
      promptId: prompt.id,
      promptName: prompt.name,
      fromVersion: options.from,
      toVersion: options.to,
      hunks,
      additions,
      deletions,
      unchanged,
      similarity,
    };
  }

  /**
   * Create a branch
   */
  async branch(
    name: string,
    input: CreateBranchInput,
    options: { environment?: string } = {},
  ): Promise<BranchInfo> {
    await this.ensureInitialized();

    const prompt = await this.get(name, { environment: options.environment });
    if (!prompt) {
      throw new Error(`Prompt '${name}' not found`);
    }

    const baseVersion = input.from || prompt.version;
    const branchInfo: BranchInfo = {
      name: input.name,
      promptId: prompt.id,
      baseVersion,
      headVersion: baseVersion,
      createdAt: new Date(),
      description: input.description,
      isActive: true,
    };

    await this.storage.saveBranch(branchInfo);

    // Audit log
    await this.logAudit('branch', 'version', prompt.id, name, {
      branch: input.name,
      baseVersion,
    });

    // Emit event
    this.emit('branch:created', {
      type: 'branch:created',
      promptId: prompt.id,
      promptName: name,
      version: baseVersion,
      timestamp: new Date(),
      data: { branch: input.name },
    });

    return branchInfo;
  }

  /**
   * Merge a branch
   */
  async merge(
    name: string,
    options: MergeOptions & { environment?: string },
  ): Promise<MergeResult> {
    await this.ensureInitialized();

    const prompt = await this.get(name, { environment: options.environment });
    if (!prompt) {
      throw new Error(`Prompt '${name}' not found`);
    }

    const branch = await this.storage.getBranch(prompt.id, options.from);
    if (!branch) {
      throw new Error(`Branch '${options.from}' not found`);
    }

    const strategy = options.strategy || 'squash';

    // Get branch head version
    const branchVersion = await this.storage.getVersion(
      prompt.id,
      branch.headVersion,
    );
    if (!branchVersion) {
      throw new Error('Branch head version not found');
    }

    // Create merged version
    const newVersion = incrementVersion(prompt.version);
    const mergedPrompt = {
      ...prompt.toData(),
      template: branchVersion.snapshot.template,
      variables: branchVersion.snapshot.variables,
      metadata: branchVersion.snapshot.metadata,
      version: newVersion,
      updatedAt: new Date(),
      hash: hashContent(branchVersion.snapshot.template),
    };

    await this.storage.savePrompt(mergedPrompt);

    // Create version entry
    const version = PromptVersion.fromPrompt(mergedPrompt, {
      message: options.message || `Merged branch '${options.from}'`,
      author: options.author,
      parentVersion: prompt.version,
    });
    await this.storage.saveVersion(version.toData());

    // Deactivate branch
    await this.storage.deleteBranch(prompt.id, options.from);

    // Invalidate cache
    if (this.cache) {
      this.cache.invalidatePattern(`^${name}:`);
    }

    // Audit log
    await this.logAudit('merge', 'version', prompt.id, name, {
      branch: options.from,
      newVersion,
      strategy,
    });

    // Emit event
    this.emit('branch:merged', {
      type: 'branch:merged',
      promptId: prompt.id,
      promptName: name,
      version: newVersion,
      timestamp: new Date(),
      data: { branch: options.from, strategy },
    });

    return {
      success: true,
      strategy,
      newVersion,
      message: `Merged branch '${options.from}' with ${strategy} strategy`,
    };
  }

  /**
   * Rollback to a previous version
   */
  async rollback(
    name: string,
    options: RollbackOptions & { environment?: string },
  ): Promise<RollbackResult> {
    await this.ensureInitialized();

    const environment = options.environment || this.defaultEnvironment;
    const prompt = await this.get(name, { environment });

    if (!prompt) {
      throw new Error(`Prompt '${name}' not found`);
    }

    // Get target version
    const targetVersion = await this.storage.getVersion(prompt.id, options.to);
    if (!targetVersion) {
      throw new Error(`Version '${options.to}' not found`);
    }

    const fromVersion = prompt.version;
    const newVersion = incrementVersion(prompt.version);

    // Create new prompt with rolled back content
    const rolledBackPrompt = {
      ...targetVersion.snapshot,
      id: prompt.id,
      version: newVersion,
      environment,
      updatedAt: new Date(),
    };

    await this.storage.savePrompt(rolledBackPrompt);

    // Create version entry
    const version = PromptVersion.fromPrompt(rolledBackPrompt, {
      message: options.reason || `Rolled back to ${options.to}`,
      author: options.author,
      parentVersion: fromVersion,
    });
    await this.storage.saveVersion(version.toData());

    // Invalidate cache
    if (this.cache) {
      this.cache.invalidatePattern(`^${name}:`);
    }

    // Audit log
    await this.logAudit('rollback', 'version', prompt.id, name, {
      fromVersion,
      toVersion: options.to,
      newVersion,
      reason: options.reason,
    });

    // Emit event
    this.emit('prompt:rolledback', {
      type: 'prompt:rolledback',
      promptId: prompt.id,
      promptName: name,
      version: newVersion,
      environment,
      timestamp: new Date(),
      data: { fromVersion, toVersion: options.to },
    });

    return {
      success: true,
      fromVersion,
      toVersion: options.to,
      newVersion,
      environment,
    };
  }

  // ==================== Environment Management ====================

  /**
   * Promote a prompt to another environment
   */
  async promote(name: string, options: PromoteInput): Promise<PromotionResult> {
    await this.ensureInitialized();

    const sourcePrompt = await this.get(name, { environment: options.from });
    if (!sourcePrompt) {
      throw new Error(`Prompt '${name}' not found in ${options.from}`);
    }

    const targetEnv = this.environments.get(options.to);
    if (!targetEnv) {
      throw new Error(`Unknown environment: ${options.to}`);
    }

    // Check if target environment is protected
    if (targetEnv.protected && !options.approver) {
      throw new Error(
        `Environment '${options.to}' is protected and requires an approver`,
      );
    }

    // Get version to promote
    const versionToPromote = options.version || sourcePrompt.version;
    const sourceVersion = await this.storage.getVersion(
      sourcePrompt.id,
      versionToPromote,
    );

    if (!sourceVersion) {
      throw new Error(`Version '${versionToPromote}' not found`);
    }

    // Check if prompt exists in target environment
    const existingInTarget = await this.storage.getPromptByName(
      name,
      options.to,
    );

    let targetPrompt: PromptData;
    let newVersion: string;

    if (existingInTarget) {
      // Update existing prompt
      newVersion = incrementVersion(existingInTarget.version);
      targetPrompt = {
        ...sourceVersion.snapshot,
        id: existingInTarget.id,
        environment: options.to,
        version: newVersion,
        updatedAt: new Date(),
      };
    } else {
      // Create new prompt in target environment
      newVersion = 'v1';
      targetPrompt = {
        ...sourceVersion.snapshot,
        id: generateId(),
        environment: options.to,
        version: newVersion,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    await this.storage.savePrompt(targetPrompt);

    // Create version entry in target
    const version = PromptVersion.fromPrompt(targetPrompt, {
      message: options.message || `Promoted from ${options.from}`,
    });
    await this.storage.saveVersion(version.toData());

    // Invalidate cache
    if (this.cache) {
      this.cache.invalidatePattern(`^${name}:`);
    }

    // Audit log
    await this.logAudit('promote', 'prompt', targetPrompt.id, name, {
      from: options.from,
      to: options.to,
      version: versionToPromote,
      newVersion,
      approver: options.approver,
    });

    // Emit event
    this.emit('prompt:promoted', {
      type: 'prompt:promoted',
      promptId: targetPrompt.id,
      promptName: name,
      version: newVersion,
      environment: options.to,
      timestamp: new Date(),
      data: { from: options.from, version: versionToPromote },
    });

    return {
      success: true,
      newVersion,
    };
  }

  /**
   * Get environments
   */
  getEnvironments(): EnvironmentConfig[] {
    return Array.from(this.environments.values()).sort(
      (a, b) => (a.order || 0) - (b.order || 0),
    );
  }

  // ==================== Partials ====================

  /**
   * Register a partial
   */
  async registerPartial(partial: Partial | PartialDefinition): Promise<void> {
    await this.ensureInitialized();

    const p = partial instanceof Partial ? partial : new Partial(partial);
    this.partials.set(p.name, p);
    await this.storage.savePartial(p.name, p.template);
  }

  /**
   * Get a partial
   */
  getPartial(name: string): Partial | undefined {
    return this.partials.get(name);
  }

  /**
   * Get all partials
   */
  getPartials(): Partial[] {
    return Array.from(this.partials.values());
  }

  /**
   * Delete a partial
   */
  async deletePartial(name: string): Promise<boolean> {
    await this.ensureInitialized();

    if (!this.partials.has(name)) {
      return false;
    }

    this.partials.delete(name);
    return this.storage.deletePartial(name);
  }

  // ==================== A/B Testing ====================

  /**
   * Create an A/B test
   */
  async createABTest(config: ABTestConfig): Promise<ABTestData> {
    await this.ensureInitialized();

    const test: ABTestData = {
      ...config,
      id: generateId(),
      status: 'draft',
      createdAt: new Date(),
    };

    await this.storage.saveTest(test);

    // Audit log
    await this.logAudit('test_create', 'test', test.id, test.name);

    // Emit event
    this.emit('test:created', {
      type: 'test:created',
      timestamp: new Date(),
      data: { testId: test.id, testName: test.name },
    });

    return test;
  }

  /**
   * Get an A/B test
   */
  async getABTest(nameOrId: string): Promise<ABTestData | null> {
    await this.ensureInitialized();

    let test = await this.storage.getTest(nameOrId);
    if (!test) {
      test = await this.storage.getTestByName(nameOrId);
    }
    return test;
  }

  // ==================== Reviews ====================

  /**
   * Request a review
   */
  async requestReview(
    name: string,
    input: CreateReviewInput,
  ): Promise<ReviewRequest> {
    await this.ensureInitialized();

    const prompt = await this.get(name);
    if (!prompt) {
      throw new Error(`Prompt '${name}' not found`);
    }

    const review: ReviewRequest = {
      id: generateId(),
      promptId: prompt.id,
      promptName: name,
      version: input.version,
      title: input.title || `Review for ${name} ${input.version}`,
      description: input.description,
      requestedBy: 'unknown', // Should be set from context
      requestedAt: new Date(),
      reviewers: input.reviewers,
      status: 'pending',
      approvals: [],
      requiredApprovals: input.requiredApprovals || 1,
      comments: [],
    };

    await this.storage.saveReview(review);

    // Audit log
    await this.logAudit('review_request', 'review', review.id, name, {
      version: input.version,
      reviewers: input.reviewers,
    });

    // Emit event
    this.emit('review:created', {
      type: 'review:created',
      promptId: prompt.id,
      promptName: name,
      version: input.version,
      timestamp: new Date(),
      data: { reviewId: review.id },
    });

    return review;
  }

  // ==================== Audit Log ====================

  /**
   * Log an audit entry
   */
  private async logAudit(
    action: AuditAction,
    resourceType: AuditLogEntry['resourceType'],
    resourceId: string,
    resourceName?: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    const entry: AuditLogEntry = {
      id: generateId(),
      timestamp: new Date(),
      actor: 'system', // Should be set from context
      action,
      resourceType,
      resourceId,
      resourceName,
      details,
    };

    await this.storage.saveAuditLog(entry);
  }

  /**
   * Get audit log
   */
  async getAuditLog(
    nameOrOptions?: string | AuditLogQueryOptions,
  ): Promise<AuditLogEntry[]> {
    await this.ensureInitialized();

    let options: AuditLogQueryOptions = {};

    if (typeof nameOrOptions === 'string') {
      const prompt = await this.get(nameOrOptions);
      if (prompt) {
        options = { resourceId: prompt.id };
      }
    } else if (nameOrOptions) {
      options = nameOrOptions;
    }

    return this.storage.queryAuditLog(options);
  }

  // ==================== Statistics ====================

  /**
   * Get registry statistics
   */
  async getStats(): Promise<RegistryStats> {
    await this.ensureInitialized();

    const allPrompts = await this.storage.queryPrompts({});

    const promptsByEnv: Record<string, number> = {};
    const promptsByStatus: Record<string, number> = {};

    for (const prompt of allPrompts) {
      promptsByEnv[prompt.environment] =
        (promptsByEnv[prompt.environment] || 0) + 1;
      promptsByStatus[prompt.status] =
        (promptsByStatus[prompt.status] || 0) + 1;
    }

    // Count versions
    let totalVersions = 0;
    for (const prompt of allPrompts) {
      const versions = await this.storage.getVersionHistory(prompt.id);
      totalVersions += versions.length;
    }

    return {
      totalPrompts: allPrompts.length,
      totalVersions,
      promptsByEnvironment: promptsByEnv,
      promptsByStatus,
      activeTests: 0, // Would need to query tests
      pendingReviews: 0, // Would need to query reviews
    };
  }

  // ==================== Lifecycle ====================

  /**
   * Close the registry
   */
  async close(): Promise<void> {
    if (this.cache) {
      this.cache.clear();
    }
    await this.storage.close();
    this.initialized = false;
  }
}
