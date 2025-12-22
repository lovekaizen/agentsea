/**
 * File-based Storage Adapter
 *
 * Stores prompts as JSON files, optimized for Git version control.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type {
  StorageAdapter,
  FileStorageConfig,
  PromptData,
  PromptQueryOptions,
  VersionHistoryEntry,
  BranchInfo,
  ABTestData,
  MetricRecord,
  VariantAssignment,
  ReviewRequest,
  Comment,
  PromotionRequest,
  AuditLogEntry,
  AuditLogQueryOptions,
} from '../../types/index.js';

/**
 * File-based storage adapter
 */
export class FileStorage implements StorageAdapter {
  private basePath: string;

  // Directory structure
  private promptsDir: string;
  private versionsDir: string;
  private branchesDir: string;
  private testsDir: string;
  private reviewsDir: string;
  private promotionsDir: string;
  private auditDir: string;
  private partialsDir: string;

  constructor(config: FileStorageConfig) {
    this.basePath = config.path;
    // Note: config.format is available for future YAML support

    this.promptsDir = path.join(this.basePath, 'prompts');
    this.versionsDir = path.join(this.basePath, 'versions');
    this.branchesDir = path.join(this.basePath, 'branches');
    this.testsDir = path.join(this.basePath, 'tests');
    this.reviewsDir = path.join(this.basePath, 'reviews');
    this.promotionsDir = path.join(this.basePath, 'promotions');
    this.auditDir = path.join(this.basePath, 'audit');
    this.partialsDir = path.join(this.basePath, 'partials');
  }

  /**
   * Initialize storage directories
   */
  async initialize(): Promise<void> {
    const dirs = [
      this.promptsDir,
      this.versionsDir,
      this.branchesDir,
      this.testsDir,
      this.reviewsDir,
      this.promotionsDir,
      this.auditDir,
      this.partialsDir,
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Close storage (no-op for file storage)
   */
  async close(): Promise<void> {
    // No cleanup needed
  }

  // ==================== File Utilities ====================

  private getPromptPath(id: string, environment: string): string {
    return path.join(this.promptsDir, environment, `${id}.json`);
  }

  private getVersionPath(promptId: string, version: string): string {
    return path.join(this.versionsDir, promptId, `${version}.json`);
  }

  private getBranchPath(promptId: string, name: string): string {
    const safeName = name.replace(/\//g, '__');
    return path.join(this.branchesDir, promptId, `${safeName}.json`);
  }

  private async readJSON<T>(filePath: string): Promise<T | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  private async writeJSON(filePath: string, data: unknown): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  private async deleteFile(filePath: string): Promise<boolean> {
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async listFiles(dir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries
        .filter((e) => e.isFile() && e.name.endsWith('.json'))
        .map((e) => path.join(dir, e.name));
    } catch {
      return [];
    }
  }

  private async listDirs(dir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  }

  // ==================== Prompt Operations ====================

  async savePrompt(prompt: PromptData): Promise<void> {
    const filePath = this.getPromptPath(prompt.id, prompt.environment);
    await this.writeJSON(filePath, prompt);

    // Also save an index file by name for quick lookup
    const indexPath = path.join(
      this.promptsDir,
      prompt.environment,
      '_index',
      `${prompt.name}.json`,
    );
    await this.writeJSON(indexPath, { id: prompt.id, name: prompt.name });
  }

  async getPrompt(id: string, environment: string): Promise<PromptData | null> {
    return this.readJSON(this.getPromptPath(id, environment));
  }

  async getPromptByName(
    name: string,
    environment: string,
  ): Promise<PromptData | null> {
    // Check index first
    const indexPath = path.join(
      this.promptsDir,
      environment,
      '_index',
      `${name}.json`,
    );
    const index = await this.readJSON<{ id: string }>(indexPath);

    if (index) {
      return this.getPrompt(index.id, environment);
    }

    // Fallback: scan all prompts
    const envDir = path.join(this.promptsDir, environment);
    const files = await this.listFiles(envDir);

    for (const file of files) {
      const prompt = await this.readJSON<PromptData>(file);
      if (prompt && prompt.name === name) {
        return prompt;
      }
    }

    return null;
  }

  async queryPrompts(options: PromptQueryOptions): Promise<PromptData[]> {
    const results: PromptData[] = [];
    const environments = options.environment
      ? [options.environment]
      : await this.listDirs(this.promptsDir);

    for (const env of environments) {
      if (env === '_index') continue;

      const envDir = path.join(this.promptsDir, env);
      const files = await this.listFiles(envDir);

      for (const file of files) {
        const prompt = await this.readJSON<PromptData>(file);
        if (!prompt) continue;

        // Apply filters
        if (options.status && prompt.status !== options.status) continue;
        if (options.tags) {
          const promptTags = prompt.metadata.tags || [];
          if (!options.tags.some((t) => promptTags.includes(t))) continue;
        }
        if (options.search) {
          const searchLower = options.search.toLowerCase();
          const matches =
            prompt.name.toLowerCase().includes(searchLower) ||
            prompt.description?.toLowerCase().includes(searchLower) ||
            prompt.template.toLowerCase().includes(searchLower);
          if (!matches) continue;
        }

        results.push(prompt);
      }
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || results.length;

    return results.slice(offset, offset + limit);
  }

  async deletePrompt(id: string): Promise<boolean> {
    // Get prompt to find environment
    const environments = await this.listDirs(this.promptsDir);

    for (const env of environments) {
      const prompt = await this.getPrompt(id, env);
      if (prompt) {
        // Delete prompt file
        await this.deleteFile(this.getPromptPath(id, env));

        // Delete index entry
        const indexPath = path.join(
          this.promptsDir,
          env,
          '_index',
          `${prompt.name}.json`,
        );
        await this.deleteFile(indexPath);

        // Delete versions
        const versionsDir = path.join(this.versionsDir, id);
        try {
          await fs.rm(versionsDir, { recursive: true });
        } catch {
          // Ignore
        }

        return true;
      }
    }

    return false;
  }

  // ==================== Version Operations ====================

  async saveVersion(version: VersionHistoryEntry): Promise<void> {
    const filePath = this.getVersionPath(version.promptId, version.version);
    await this.writeJSON(filePath, version);
  }

  async getVersion(
    promptId: string,
    version: string,
  ): Promise<VersionHistoryEntry | null> {
    return this.readJSON(this.getVersionPath(promptId, version));
  }

  async getVersionHistory(
    promptId: string,
    limit?: number,
  ): Promise<VersionHistoryEntry[]> {
    const versionsDir = path.join(this.versionsDir, promptId);
    const files = await this.listFiles(versionsDir);

    const versions: VersionHistoryEntry[] = [];
    for (const file of files) {
      const version = await this.readJSON<VersionHistoryEntry>(file);
      if (version) {
        versions.push(version);
      }
    }

    // Sort by version (descending)
    versions.sort((a, b) => {
      const aNum = parseInt(a.version.replace('v', ''), 10);
      const bNum = parseInt(b.version.replace('v', ''), 10);
      return bNum - aNum;
    });

    return limit ? versions.slice(0, limit) : versions;
  }

  // ==================== Branch Operations ====================

  async saveBranch(branch: BranchInfo): Promise<void> {
    const filePath = this.getBranchPath(branch.promptId, branch.name);
    await this.writeJSON(filePath, branch);
  }

  async getBranch(promptId: string, name: string): Promise<BranchInfo | null> {
    return this.readJSON(this.getBranchPath(promptId, name));
  }

  async getBranches(promptId: string): Promise<BranchInfo[]> {
    const branchDir = path.join(this.branchesDir, promptId);
    const files = await this.listFiles(branchDir);

    const branches: BranchInfo[] = [];
    for (const file of files) {
      const branch = await this.readJSON<BranchInfo>(file);
      if (branch) {
        branches.push(branch);
      }
    }

    return branches;
  }

  async deleteBranch(promptId: string, name: string): Promise<boolean> {
    return this.deleteFile(this.getBranchPath(promptId, name));
  }

  // ==================== A/B Test Operations ====================

  async saveTest(test: ABTestData): Promise<void> {
    const filePath = path.join(this.testsDir, `${test.id}.json`);
    await this.writeJSON(filePath, test);

    // Index by name
    const indexPath = path.join(this.testsDir, '_index', `${test.name}.json`);
    await this.writeJSON(indexPath, { id: test.id });
  }

  async getTest(id: string): Promise<ABTestData | null> {
    return this.readJSON(path.join(this.testsDir, `${id}.json`));
  }

  async getTestByName(name: string): Promise<ABTestData | null> {
    const indexPath = path.join(this.testsDir, '_index', `${name}.json`);
    const index = await this.readJSON<{ id: string }>(indexPath);

    if (index) {
      return this.getTest(index.id);
    }
    return null;
  }

  async getTestsForPrompt(promptName: string): Promise<ABTestData[]> {
    const files = await this.listFiles(this.testsDir);
    const tests: ABTestData[] = [];

    for (const file of files) {
      const test = await this.readJSON<ABTestData>(file);
      if (test && test.prompt === promptName) {
        tests.push(test);
      }
    }

    return tests;
  }

  async updateTestStatus(id: string, status: string): Promise<void> {
    const test = await this.getTest(id);
    if (test) {
      test.status = status as ABTestData['status'];
      await this.saveTest(test);
    }
  }

  // ==================== Test Metric Operations ====================

  async saveMetricRecord(record: MetricRecord): Promise<void> {
    const dir = path.join(this.testsDir, record.testId, 'metrics');
    const filePath = path.join(
      dir,
      `${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    await this.writeJSON(filePath, record);
  }

  async getMetricRecords(
    testId: string,
    metric?: string,
  ): Promise<MetricRecord[]> {
    const dir = path.join(this.testsDir, testId, 'metrics');
    const files = await this.listFiles(dir);

    const records: MetricRecord[] = [];
    for (const file of files) {
      const record = await this.readJSON<MetricRecord>(file);
      if (record) {
        if (!metric || record.metric === metric) {
          records.push(record);
        }
      }
    }

    return records;
  }

  async saveVariantAssignment(assignment: VariantAssignment): Promise<void> {
    const dir = path.join(this.testsDir, assignment.testId, 'assignments');
    const filePath = path.join(dir, `${assignment.userId}.json`);
    await this.writeJSON(filePath, assignment);
  }

  async getVariantAssignment(
    testId: string,
    userId: string,
  ): Promise<VariantAssignment | null> {
    const filePath = path.join(
      this.testsDir,
      testId,
      'assignments',
      `${userId}.json`,
    );
    return this.readJSON(filePath);
  }

  // ==================== Review Operations ====================

  async saveReview(review: ReviewRequest): Promise<void> {
    const filePath = path.join(this.reviewsDir, `${review.id}.json`);
    await this.writeJSON(filePath, review);
  }

  async getReview(id: string): Promise<ReviewRequest | null> {
    return this.readJSON(path.join(this.reviewsDir, `${id}.json`));
  }

  async getReviewsForPrompt(promptId: string): Promise<ReviewRequest[]> {
    const files = await this.listFiles(this.reviewsDir);
    const reviews: ReviewRequest[] = [];

    for (const file of files) {
      const review = await this.readJSON<ReviewRequest>(file);
      if (review && review.promptId === promptId) {
        reviews.push(review);
      }
    }

    return reviews;
  }

  async updateReview(
    id: string,
    updates: Partial<ReviewRequest>,
  ): Promise<void> {
    const review = await this.getReview(id);
    if (review) {
      const updated = { ...review, ...updates };
      await this.saveReview(updated);
    }
  }

  // ==================== Comment Operations ====================

  async saveComment(comment: Comment): Promise<void> {
    const dir = path.join(this.reviewsDir, comment.reviewId, 'comments');
    const filePath = path.join(dir, `${comment.id}.json`);
    await this.writeJSON(filePath, comment);
  }

  async getComments(reviewId: string): Promise<Comment[]> {
    const dir = path.join(this.reviewsDir, reviewId, 'comments');
    const files = await this.listFiles(dir);

    const comments: Comment[] = [];
    for (const file of files) {
      const comment = await this.readJSON<Comment>(file);
      if (comment) {
        comments.push(comment);
      }
    }

    return comments.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  async updateComment(id: string, updates: Partial<Comment>): Promise<void> {
    // Need to find the comment first
    const reviewDirs = await this.listDirs(this.reviewsDir);

    for (const reviewId of reviewDirs) {
      const comments = await this.getComments(reviewId);
      const comment = comments.find((c) => c.id === id);

      if (comment) {
        const updated = { ...comment, ...updates, updatedAt: new Date() };
        await this.saveComment(updated);
        return;
      }
    }
  }

  // ==================== Promotion Operations ====================

  async savePromotionRequest(request: PromotionRequest): Promise<void> {
    const filePath = path.join(this.promotionsDir, `${request.id}.json`);
    await this.writeJSON(filePath, request);
  }

  async getPromotionRequest(id: string): Promise<PromotionRequest | null> {
    return this.readJSON(path.join(this.promotionsDir, `${id}.json`));
  }

  async getPendingPromotions(
    environment?: string,
  ): Promise<PromotionRequest[]> {
    const files = await this.listFiles(this.promotionsDir);
    const promotions: PromotionRequest[] = [];

    for (const file of files) {
      const promotion = await this.readJSON<PromotionRequest>(file);
      if (
        promotion &&
        promotion.status === 'pending' &&
        (!environment || promotion.toEnvironment === environment)
      ) {
        promotions.push(promotion);
      }
    }

    return promotions;
  }

  async updatePromotionRequest(
    id: string,
    updates: Partial<PromotionRequest>,
  ): Promise<void> {
    const promotion = await this.getPromotionRequest(id);
    if (promotion) {
      const updated = { ...promotion, ...updates };
      await this.savePromotionRequest(updated);
    }
  }

  // ==================== Audit Log Operations ====================

  async saveAuditLog(entry: AuditLogEntry): Promise<void> {
    // Organize by date for efficient querying
    const date = new Date(entry.timestamp);
    const dateStr = date.toISOString().split('T')[0];
    const dir = path.join(this.auditDir, dateStr);
    const filePath = path.join(dir, `${entry.id}.json`);
    await this.writeJSON(filePath, entry);
  }

  async queryAuditLog(options: AuditLogQueryOptions): Promise<AuditLogEntry[]> {
    const entries: AuditLogEntry[] = [];

    // Determine date range
    const startDate =
      options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = options.endDate || new Date();

    // List date directories
    const dateDirs = await this.listDirs(this.auditDir);

    for (const dateStr of dateDirs) {
      const date = new Date(dateStr);
      if (date < startDate || date > endDate) continue;

      const dir = path.join(this.auditDir, dateStr);
      const files = await this.listFiles(dir);

      for (const file of files) {
        const entry = await this.readJSON<AuditLogEntry>(file);
        if (!entry) continue;

        // Apply filters
        if (options.actor && entry.actor !== options.actor) continue;
        if (options.action && entry.action !== options.action) continue;
        if (options.resourceType && entry.resourceType !== options.resourceType)
          continue;
        if (options.resourceId && entry.resourceId !== options.resourceId)
          continue;

        entries.push(entry);
      }
    }

    // Sort by timestamp (descending)
    entries.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || entries.length;

    return entries.slice(offset, offset + limit);
  }

  // ==================== Partial Operations ====================

  async savePartial(name: string, template: string): Promise<void> {
    const filePath = path.join(this.partialsDir, `${name}.json`);
    await this.writeJSON(filePath, { name, template });
  }

  async getPartial(name: string): Promise<string | null> {
    const data = await this.readJSON<{ template: string }>(
      path.join(this.partialsDir, `${name}.json`),
    );
    return data?.template || null;
  }

  async getAllPartials(): Promise<Record<string, string>> {
    const files = await this.listFiles(this.partialsDir);
    const partials: Record<string, string> = {};

    for (const file of files) {
      const data = await this.readJSON<{ name: string; template: string }>(
        file,
      );
      if (data) {
        partials[data.name] = data.template;
      }
    }

    return partials;
  }

  async deletePartial(name: string): Promise<boolean> {
    return this.deleteFile(path.join(this.partialsDir, `${name}.json`));
  }
}
