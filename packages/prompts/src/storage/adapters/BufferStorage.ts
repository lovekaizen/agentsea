/**
 * Buffer (In-Memory) Storage Adapter
 *
 * Fast, ephemeral storage for testing and development.
 */

import type {
  StorageAdapter,
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
 * In-memory storage adapter
 */
export class BufferStorage implements StorageAdapter {
  private prompts = new Map<string, PromptData>();
  private promptsByName = new Map<string, Map<string, string>>(); // env -> name -> id
  private versions = new Map<string, Map<string, VersionHistoryEntry>>(); // promptId -> version -> entry
  private branches = new Map<string, Map<string, BranchInfo>>(); // promptId -> branchName -> info
  private tests = new Map<string, ABTestData>();
  private testsByName = new Map<string, string>(); // name -> id
  private metricRecords = new Map<string, MetricRecord[]>(); // testId -> records
  private variantAssignments = new Map<
    string,
    Map<string, VariantAssignment>
  >(); // testId -> userId -> assignment
  private reviews = new Map<string, ReviewRequest>();
  private comments = new Map<string, Comment[]>(); // reviewId -> comments
  private promotions = new Map<string, PromotionRequest>();
  private auditLog: AuditLogEntry[] = [];
  private partials = new Map<string, string>();

  async initialize(): Promise<void> {
    // No initialization needed for in-memory storage
    return Promise.resolve();
  }

  async close(): Promise<void> {
    // Clear all data
    this.prompts.clear();
    this.promptsByName.clear();
    this.versions.clear();
    this.branches.clear();
    this.tests.clear();
    this.testsByName.clear();
    this.metricRecords.clear();
    this.variantAssignments.clear();
    this.reviews.clear();
    this.comments.clear();
    this.promotions.clear();
    this.auditLog = [];
    this.partials.clear();
    return Promise.resolve();
  }

  // ==================== Prompt Operations ====================

  async savePrompt(prompt: PromptData): Promise<void> {
    const key = `${prompt.environment}:${prompt.id}`;
    this.prompts.set(key, { ...prompt });

    // Update name index
    if (!this.promptsByName.has(prompt.environment)) {
      this.promptsByName.set(prompt.environment, new Map());
    }
    this.promptsByName.get(prompt.environment)!.set(prompt.name, prompt.id);
    return Promise.resolve();
  }

  async getPrompt(id: string, environment: string): Promise<PromptData | null> {
    const key = `${environment}:${id}`;
    const prompt = this.prompts.get(key);
    return Promise.resolve(prompt ? { ...prompt } : null);
  }

  async getPromptByName(
    name: string,
    environment: string,
  ): Promise<PromptData | null> {
    const envIndex = this.promptsByName.get(environment);
    if (!envIndex) return null;

    const id = envIndex.get(name);
    if (!id) return null;

    return this.getPrompt(id, environment);
  }

  async queryPrompts(options: PromptQueryOptions): Promise<PromptData[]> {
    const results: PromptData[] = [];

    for (const prompt of this.prompts.values()) {
      // Environment filter
      if (options.environment && prompt.environment !== options.environment)
        continue;

      // Status filter
      if (options.status && prompt.status !== options.status) continue;

      // Tags filter
      if (options.tags) {
        const promptTags = prompt.metadata.tags || [];
        if (!options.tags.some((t) => promptTags.includes(t))) continue;
      }

      // Search filter
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        const matches =
          prompt.name.toLowerCase().includes(searchLower) ||
          prompt.description?.toLowerCase().includes(searchLower) ||
          prompt.template.toLowerCase().includes(searchLower);
        if (!matches) continue;
      }

      results.push({ ...prompt });
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || results.length;

    return Promise.resolve(results.slice(offset, offset + limit));
  }

  async deletePrompt(id: string): Promise<boolean> {
    let found = false;

    for (const [key, prompt] of this.prompts.entries()) {
      if (key.endsWith(`:${id}`)) {
        this.prompts.delete(key);

        // Remove from name index
        const envIndex = this.promptsByName.get(prompt.environment);
        if (envIndex) {
          envIndex.delete(prompt.name);
        }

        // Remove versions
        this.versions.delete(id);

        // Remove branches
        this.branches.delete(id);

        found = true;
      }
    }

    return Promise.resolve(found);
  }

  // ==================== Version Operations ====================

  async saveVersion(version: VersionHistoryEntry): Promise<void> {
    if (!this.versions.has(version.promptId)) {
      this.versions.set(version.promptId, new Map());
    }
    this.versions.get(version.promptId)!.set(version.version, { ...version });
    return Promise.resolve();
  }

  async getVersion(
    promptId: string,
    version: string,
  ): Promise<VersionHistoryEntry | null> {
    const promptVersions = this.versions.get(promptId);
    if (!promptVersions) return Promise.resolve(null);

    const entry = promptVersions.get(version);
    return Promise.resolve(entry ? { ...entry } : null);
  }

  async getVersionHistory(
    promptId: string,
    limit?: number,
  ): Promise<VersionHistoryEntry[]> {
    const promptVersions = this.versions.get(promptId);
    if (!promptVersions) return Promise.resolve([]);

    const versions = Array.from(promptVersions.values()).sort((a, b) => {
      const aNum = parseInt(a.version.replace('v', ''), 10);
      const bNum = parseInt(b.version.replace('v', ''), 10);
      return bNum - aNum;
    });

    return Promise.resolve(
      (limit ? versions.slice(0, limit) : versions).map((v) => ({ ...v })),
    );
  }

  // ==================== Branch Operations ====================

  async saveBranch(branch: BranchInfo): Promise<void> {
    if (!this.branches.has(branch.promptId)) {
      this.branches.set(branch.promptId, new Map());
    }
    this.branches.get(branch.promptId)!.set(branch.name, { ...branch });
    return Promise.resolve();
  }

  async getBranch(promptId: string, name: string): Promise<BranchInfo | null> {
    const promptBranches = this.branches.get(promptId);
    if (!promptBranches) return Promise.resolve(null);

    const branch = promptBranches.get(name);
    return Promise.resolve(branch ? { ...branch } : null);
  }

  async getBranches(promptId: string): Promise<BranchInfo[]> {
    const promptBranches = this.branches.get(promptId);
    if (!promptBranches) return Promise.resolve([]);

    return Promise.resolve(
      Array.from(promptBranches.values()).map((b) => ({ ...b })),
    );
  }

  async deleteBranch(promptId: string, name: string): Promise<boolean> {
    const promptBranches = this.branches.get(promptId);
    if (!promptBranches) return Promise.resolve(false);

    return Promise.resolve(promptBranches.delete(name));
  }

  // ==================== A/B Test Operations ====================

  async saveTest(test: ABTestData): Promise<void> {
    this.tests.set(test.id, { ...test });
    this.testsByName.set(test.name, test.id);
    return Promise.resolve();
  }

  async getTest(id: string): Promise<ABTestData | null> {
    const test = this.tests.get(id);
    return Promise.resolve(test ? { ...test } : null);
  }

  async getTestByName(name: string): Promise<ABTestData | null> {
    const id = this.testsByName.get(name);
    if (!id) return null;
    return this.getTest(id);
  }

  async getTestsForPrompt(promptName: string): Promise<ABTestData[]> {
    return Promise.resolve(
      Array.from(this.tests.values())
        .filter((t) => t.prompt === promptName)
        .map((t) => ({ ...t })),
    );
  }

  async updateTestStatus(id: string, status: string): Promise<void> {
    const test = this.tests.get(id);
    if (test) {
      test.status = status as ABTestData['status'];
    }
    return Promise.resolve();
  }

  // ==================== Test Metric Operations ====================

  async saveMetricRecord(record: MetricRecord): Promise<void> {
    if (!this.metricRecords.has(record.testId)) {
      this.metricRecords.set(record.testId, []);
    }
    this.metricRecords.get(record.testId)!.push({ ...record });
    return Promise.resolve();
  }

  async getMetricRecords(
    testId: string,
    metric?: string,
  ): Promise<MetricRecord[]> {
    const records = this.metricRecords.get(testId) || [];
    if (metric) {
      return Promise.resolve(
        records.filter((r) => r.metric === metric).map((r) => ({ ...r })),
      );
    }
    return Promise.resolve(records.map((r) => ({ ...r })));
  }

  async saveVariantAssignment(assignment: VariantAssignment): Promise<void> {
    if (!this.variantAssignments.has(assignment.testId)) {
      this.variantAssignments.set(assignment.testId, new Map());
    }
    this.variantAssignments
      .get(assignment.testId)!
      .set(assignment.userId, { ...assignment });
    return Promise.resolve();
  }

  async getVariantAssignment(
    testId: string,
    userId: string,
  ): Promise<VariantAssignment | null> {
    const testAssignments = this.variantAssignments.get(testId);
    if (!testAssignments) return Promise.resolve(null);

    const assignment = testAssignments.get(userId);
    return Promise.resolve(assignment ? { ...assignment } : null);
  }

  // ==================== Review Operations ====================

  async saveReview(review: ReviewRequest): Promise<void> {
    this.reviews.set(review.id, { ...review });
    return Promise.resolve();
  }

  async getReview(id: string): Promise<ReviewRequest | null> {
    const review = this.reviews.get(id);
    return Promise.resolve(review ? { ...review } : null);
  }

  async getReviewsForPrompt(promptId: string): Promise<ReviewRequest[]> {
    return Promise.resolve(
      Array.from(this.reviews.values())
        .filter((r) => r.promptId === promptId)
        .map((r) => ({ ...r })),
    );
  }

  async updateReview(
    id: string,
    updates: Partial<ReviewRequest>,
  ): Promise<void> {
    const review = this.reviews.get(id);
    if (review) {
      Object.assign(review, updates);
    }
    return Promise.resolve();
  }

  // ==================== Comment Operations ====================

  async saveComment(comment: Comment): Promise<void> {
    if (!this.comments.has(comment.reviewId)) {
      this.comments.set(comment.reviewId, []);
    }

    const comments = this.comments.get(comment.reviewId)!;
    const index = comments.findIndex((c) => c.id === comment.id);

    if (index >= 0) {
      comments[index] = { ...comment };
    } else {
      comments.push({ ...comment });
    }
    return Promise.resolve();
  }

  async getComments(reviewId: string): Promise<Comment[]> {
    const comments = this.comments.get(reviewId) || [];
    return Promise.resolve(
      comments
        .map((c) => ({ ...c }))
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
    );
  }

  async updateComment(id: string, updates: Partial<Comment>): Promise<void> {
    for (const comments of this.comments.values()) {
      const comment = comments.find((c) => c.id === id);
      if (comment) {
        Object.assign(comment, updates, { updatedAt: new Date() });
        return Promise.resolve();
      }
    }
    return Promise.resolve();
  }

  // ==================== Promotion Operations ====================

  async savePromotionRequest(request: PromotionRequest): Promise<void> {
    this.promotions.set(request.id, { ...request });
    return Promise.resolve();
  }

  async getPromotionRequest(id: string): Promise<PromotionRequest | null> {
    const promotion = this.promotions.get(id);
    return Promise.resolve(promotion ? { ...promotion } : null);
  }

  async getPendingPromotions(
    environment?: string,
  ): Promise<PromotionRequest[]> {
    return Promise.resolve(
      Array.from(this.promotions.values())
        .filter(
          (p) =>
            p.status === 'pending' &&
            (!environment || p.toEnvironment === environment),
        )
        .map((p) => ({ ...p })),
    );
  }

  async updatePromotionRequest(
    id: string,
    updates: Partial<PromotionRequest>,
  ): Promise<void> {
    const promotion = this.promotions.get(id);
    if (promotion) {
      Object.assign(promotion, updates);
    }
    return Promise.resolve();
  }

  // ==================== Audit Log Operations ====================

  async saveAuditLog(entry: AuditLogEntry): Promise<void> {
    this.auditLog.push({ ...entry });
    return Promise.resolve();
  }

  async queryAuditLog(options: AuditLogQueryOptions): Promise<AuditLogEntry[]> {
    let entries = [...this.auditLog];

    // Apply filters
    if (options.actor) {
      entries = entries.filter((e) => e.actor === options.actor);
    }
    if (options.action) {
      entries = entries.filter((e) => e.action === options.action);
    }
    if (options.resourceType) {
      entries = entries.filter((e) => e.resourceType === options.resourceType);
    }
    if (options.resourceId) {
      entries = entries.filter((e) => e.resourceId === options.resourceId);
    }
    if (options.startDate) {
      entries = entries.filter(
        (e) => new Date(e.timestamp) >= options.startDate!,
      );
    }
    if (options.endDate) {
      entries = entries.filter(
        (e) => new Date(e.timestamp) <= options.endDate!,
      );
    }

    // Sort by timestamp (descending)
    entries.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || entries.length;

    return Promise.resolve(
      entries.slice(offset, offset + limit).map((e) => ({ ...e })),
    );
  }

  // ==================== Partial Operations ====================

  async savePartial(name: string, template: string): Promise<void> {
    this.partials.set(name, template);
    return Promise.resolve();
  }

  async getPartial(name: string): Promise<string | null> {
    return Promise.resolve(this.partials.get(name) || null);
  }

  async getAllPartials(): Promise<Record<string, string>> {
    return Promise.resolve(Object.fromEntries(this.partials.entries()));
  }

  async deletePartial(name: string): Promise<boolean> {
    return Promise.resolve(this.partials.delete(name));
  }
}
