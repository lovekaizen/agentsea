/**
 * Environment Type Definitions
 */

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  name: string;
  label?: string;
  description?: string;
  protected?: boolean; // Requires approval for changes
  color?: string; // UI color
  order?: number; // Display order
}

/**
 * Promotion request
 */
export interface PromotionRequest {
  id: string;
  promptId: string;
  promptName: string;
  fromEnvironment: string;
  toEnvironment: string;
  version: string;
  requestedBy: string;
  requestedAt: Date;
  status: PromotionStatus;
  message?: string;
  approver?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
}

/**
 * Promotion status
 */
export type PromotionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'cancelled';

/**
 * Promotion input
 */
export interface PromoteInput {
  from: string;
  to: string;
  version?: string; // Defaults to latest in source environment
  message?: string;
  approver?: string; // For protected environments
}

/**
 * Promotion result
 */
export interface PromotionResult {
  success: boolean;
  request?: PromotionRequest;
  newVersion?: string;
  error?: string;
  requiresApproval?: boolean;
}

/**
 * Environment sync status
 */
export interface EnvironmentSyncStatus {
  environment: string;
  version: string;
  isSynced: boolean;
  lastSyncedAt?: Date;
  aheadBy?: number;
  behindBy?: number;
}

/**
 * Environment comparison
 */
export interface EnvironmentComparison {
  promptId: string;
  promptName: string;
  environments: Record<
    string,
    {
      version: string;
      updatedAt: Date;
      status: string;
    } | null
  >;
  differences: string[];
}
