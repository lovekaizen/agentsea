/**
 * Collaboration Type Definitions
 */

/**
 * Review status
 */
export type ReviewStatus =
  | 'pending'
  | 'approved'
  | 'changes_requested'
  | 'rejected'
  | 'merged';

/**
 * Review request
 */
export interface ReviewRequest {
  id: string;
  promptId: string;
  promptName: string;
  version: string;
  title: string;
  description?: string;
  requestedBy: string;
  requestedAt: Date;
  reviewers: string[];
  status: ReviewStatus;
  approvals: ReviewApproval[];
  requiredApprovals: number;
  comments: Comment[];
  closedAt?: Date;
  closedBy?: string;
  mergedAt?: Date;
  mergedBy?: string;
}

/**
 * Review approval
 */
export interface ReviewApproval {
  reviewer: string;
  status: 'approved' | 'changes_requested' | 'rejected';
  comment?: string;
  timestamp: Date;
}

/**
 * Create review input
 */
export interface CreateReviewInput {
  version: string;
  title?: string;
  description?: string;
  reviewers: string[];
  requiredApprovals?: number;
}

/**
 * Comment
 */
export interface Comment {
  id: string;
  reviewId: string;
  author: string;
  content: string;
  line?: number; // Line number in template
  parentId?: string; // For replies
  createdAt: Date;
  updatedAt?: Date;
  resolved?: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
}

/**
 * Create comment input
 */
export interface CreateCommentInput {
  content: string;
  line?: number;
  parentId?: string;
}

/**
 * Permission types
 */
export type Permission = 'read' | 'write' | 'admin' | 'promote' | 'review';

/**
 * Role definition
 */
export interface Role {
  name: string;
  permissions: Permission[];
  environments?: string[]; // Allowed environments
  description?: string;
}

/**
 * User permission assignment
 */
export interface UserPermissions {
  userId: string;
  roles: string[];
  customPermissions?: Permission[];
  deniedPermissions?: Permission[];
}

/**
 * Access control check
 */
export interface AccessCheck {
  userId: string;
  permission: Permission;
  resource?: string; // Prompt ID or environment
  environment?: string;
}

/**
 * Access check result
 */
export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
  grantedBy?: string; // Role or custom permission
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  actor: string;
  action: AuditAction;
  resourceType:
    | 'prompt'
    | 'version'
    | 'environment'
    | 'test'
    | 'review'
    | 'permission';
  resourceId: string;
  resourceName?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit actions
 */
export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'promote'
  | 'rollback'
  | 'branch'
  | 'merge'
  | 'review_request'
  | 'review_approve'
  | 'review_reject'
  | 'comment'
  | 'permission_grant'
  | 'permission_revoke'
  | 'test_create'
  | 'test_start'
  | 'test_end';

/**
 * Audit log query options
 */
export interface AuditLogQueryOptions {
  actor?: string;
  action?: AuditAction;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}
