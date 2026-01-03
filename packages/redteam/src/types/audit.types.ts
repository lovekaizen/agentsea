/**
 * Audit Types for Logging and Evidence Collection
 */

import type { Severity } from './attack.types.js';
import type { Evidence } from './compliance.types.js';

/**
 * Audit event type
 */
export type AuditEventType =
  | 'test_started'
  | 'test_completed'
  | 'test_failed'
  | 'scan_started'
  | 'scan_completed'
  | 'vulnerability_found'
  | 'detection_triggered'
  | 'compliance_check'
  | 'configuration_change'
  | 'access'
  | 'export'
  | 'custom';

/**
 * Audit entry
 */
export interface AuditEntry {
  /** Entry ID */
  id: string;
  /** Timestamp */
  timestamp: number;
  /** Event type */
  eventType: AuditEventType;
  /** Action performed */
  action: string;
  /** Actor (user/system/agent) */
  actor: AuditActor;
  /** Resource affected */
  resource: AuditResource;
  /** Outcome */
  outcome: 'success' | 'failure' | 'error' | 'warning';
  /** Details */
  details: Record<string, unknown>;
  /** Severity */
  severity?: Severity;
  /** Session ID */
  sessionId?: string;
  /** Correlation ID for related events */
  correlationId?: string;
  /** Tags */
  tags?: string[];
  /** IP address if applicable */
  ipAddress?: string;
  /** User agent if applicable */
  userAgent?: string;
  /** Hash for integrity */
  hash?: string;
  /** Previous hash for chain integrity */
  previousHash?: string;
}

/**
 * Audit actor
 */
export interface AuditActor {
  /** Actor type */
  type: 'user' | 'system' | 'agent' | 'service' | 'external';
  /** Actor ID */
  id: string;
  /** Actor name */
  name?: string;
  /** Role */
  role?: string;
  /** Attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Audit resource
 */
export interface AuditResource {
  /** Resource type */
  type:
    | 'test'
    | 'scan'
    | 'benchmark'
    | 'compliance'
    | 'report'
    | 'configuration'
    | 'data'
    | 'custom';
  /** Resource ID */
  id: string;
  /** Resource name */
  name?: string;
  /** Path or location */
  path?: string;
  /** Attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Audit trail
 */
export interface AuditTrail {
  /** Trail ID */
  id: string;
  /** Name */
  name: string;
  /** Description */
  description?: string;
  /** Start time */
  startTime: number;
  /** End time */
  endTime?: number;
  /** Status */
  status: 'active' | 'completed' | 'archived';
  /** Entries */
  entries: AuditEntry[];
  /** Summary */
  summary?: AuditTrailSummary;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Audit trail summary
 */
export interface AuditTrailSummary {
  /** Total entries */
  totalEntries: number;
  /** By event type */
  byEventType: Record<AuditEventType, number>;
  /** By outcome */
  byOutcome: Record<string, number>;
  /** By severity */
  bySeverity: Record<Severity, number>;
  /** Unique actors */
  uniqueActors: number;
  /** Unique resources */
  uniqueResources: number;
  /** Time span */
  timeSpan: {
    start: number;
    end: number;
    durationMs: number;
  };
}

/**
 * Audit log configuration
 */
export interface AuditLogConfig {
  /** Enable audit logging */
  enabled: boolean;
  /** Event types to log */
  eventTypes: AuditEventType[];
  /** Minimum severity to log */
  minSeverity?: Severity;
  /** Storage backend */
  storage: AuditStorageConfig;
  /** Retention policy */
  retention?: AuditRetentionPolicy;
  /** Integrity verification */
  integrityVerification?: boolean;
  /** Hash algorithm */
  hashAlgorithm?: 'sha256' | 'sha512' | 'sha3-256';
  /** Include stack traces */
  includeStackTraces?: boolean;
  /** Redact sensitive data */
  redactSensitive?: boolean;
  /** Sensitive field patterns */
  sensitivePatterns?: RegExp[];
}

/**
 * Audit storage configuration
 */
export interface AuditStorageConfig {
  /** Storage type */
  type: 'memory' | 'file' | 'database' | 'cloud' | 'custom';
  /** Connection string or path */
  connection?: string;
  /** Table/collection name */
  tableName?: string;
  /** Batch size for writes */
  batchSize?: number;
  /** Flush interval in ms */
  flushIntervalMs?: number;
  /** Encryption */
  encryption?: {
    enabled: boolean;
    algorithm?: string;
    keyId?: string;
  };
}

/**
 * Audit retention policy
 */
export interface AuditRetentionPolicy {
  /** Retention period in days */
  retentionDays: number;
  /** Archive before delete */
  archiveBeforeDelete?: boolean;
  /** Archive location */
  archiveLocation?: string;
  /** Compression */
  compress?: boolean;
}

/**
 * Audit query
 */
export interface AuditQuery {
  /** Time range */
  timeRange?: {
    start: number;
    end: number;
  };
  /** Event types */
  eventTypes?: AuditEventType[];
  /** Actor IDs */
  actorIds?: string[];
  /** Resource IDs */
  resourceIds?: string[];
  /** Outcomes */
  outcomes?: string[];
  /** Severities */
  severities?: Severity[];
  /** Search text */
  searchText?: string;
  /** Tags */
  tags?: string[];
  /** Correlation ID */
  correlationId?: string;
  /** Limit */
  limit?: number;
  /** Offset */
  offset?: number;
  /** Sort */
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
}

/**
 * Audit query result
 */
export interface AuditQueryResult {
  /** Matching entries */
  entries: AuditEntry[];
  /** Total count */
  totalCount: number;
  /** Page info */
  pageInfo: {
    offset: number;
    limit: number;
    hasMore: boolean;
  };
  /** Query metadata */
  queryMetadata: {
    executionTimeMs: number;
    query: AuditQuery;
  };
}

/**
 * Evidence collection configuration
 */
export interface EvidenceCollectionConfig {
  /** Enable evidence collection */
  enabled: boolean;
  /** Evidence types to collect */
  evidenceTypes: EvidenceCollectionType[];
  /** Storage location */
  storagePath: string;
  /** Max evidence size in bytes */
  maxEvidenceSize?: number;
  /** Compression */
  compress?: boolean;
  /** Include timestamps */
  includeTimestamps?: boolean;
  /** Hash evidence for integrity */
  hashEvidence?: boolean;
  /** Screenshot configuration */
  screenshots?: {
    enabled: boolean;
    format: 'png' | 'jpeg';
    quality?: number;
  };
}

/**
 * Evidence collection type
 */
export type EvidenceCollectionType =
  | 'request'
  | 'response'
  | 'log'
  | 'screenshot'
  | 'configuration'
  | 'test_result'
  | 'metric'
  | 'all';

/**
 * Collected evidence package
 */
export interface EvidencePackage {
  /** Package ID */
  id: string;
  /** Name */
  name: string;
  /** Description */
  description?: string;
  /** Created at */
  createdAt: number;
  /** Evidence items */
  evidence: Evidence[];
  /** Summary */
  summary: EvidencePackageSummary;
  /** Metadata */
  metadata?: Record<string, unknown>;
  /** Package hash */
  hash?: string;
  /** Signature */
  signature?: string;
}

/**
 * Evidence package summary
 */
export interface EvidencePackageSummary {
  /** Total items */
  totalItems: number;
  /** By type */
  byType: Record<string, number>;
  /** Total size in bytes */
  totalSizeBytes: number;
  /** Time range */
  timeRange: {
    start: number;
    end: number;
  };
}

/**
 * Audit report configuration
 */
export interface AuditReportConfig {
  /** Report type */
  type: 'summary' | 'detailed' | 'compliance' | 'executive';
  /** Time range */
  timeRange: {
    start: number;
    end: number;
  };
  /** Include sections */
  sections: AuditReportSection[];
  /** Format */
  format: 'json' | 'pdf' | 'html' | 'markdown';
  /** Include charts */
  includeCharts?: boolean;
  /** Include evidence */
  includeEvidence?: boolean;
  /** Branding */
  branding?: {
    logo?: string;
    companyName?: string;
    colors?: Record<string, string>;
  };
}

/**
 * Audit report sections
 */
export type AuditReportSection =
  | 'executive_summary'
  | 'timeline'
  | 'actor_activity'
  | 'resource_access'
  | 'security_events'
  | 'compliance_events'
  | 'anomalies'
  | 'recommendations';

/**
 * Audit report
 */
export interface AuditReport {
  /** Report ID */
  id: string;
  /** Title */
  title: string;
  /** Generated at */
  generatedAt: number;
  /** Report type */
  type: AuditReportConfig['type'];
  /** Time range covered */
  timeRange: {
    start: number;
    end: number;
  };
  /** Executive summary */
  executiveSummary?: string;
  /** Sections */
  sections: Record<AuditReportSection, unknown>;
  /** Statistics */
  statistics: AuditTrailSummary;
  /** Recommendations */
  recommendations?: string[];
  /** Appendix with evidence */
  appendix?: {
    evidence: Evidence[];
    rawData?: unknown;
  };
}

/**
 * Chain of custody record
 */
export interface ChainOfCustodyRecord {
  /** Record ID */
  id: string;
  /** Evidence ID */
  evidenceId: string;
  /** Action */
  action:
    | 'collected'
    | 'transferred'
    | 'analyzed'
    | 'stored'
    | 'exported'
    | 'deleted';
  /** Actor */
  actor: AuditActor;
  /** Timestamp */
  timestamp: number;
  /** Location/system */
  location?: string;
  /** Notes */
  notes?: string;
  /** Hash at this point */
  hash?: string;
  /** Previous record ID */
  previousRecordId?: string;
}

/**
 * Audit integrity check result
 */
export interface AuditIntegrityCheckResult {
  /** Overall integrity status */
  status: 'valid' | 'tampered' | 'incomplete' | 'error';
  /** Total entries checked */
  totalEntries: number;
  /** Valid entries */
  validEntries: number;
  /** Tampered entries */
  tamperedEntries: AuditEntry[];
  /** Missing entries (gaps in chain) */
  missingEntries: number;
  /** Check timestamp */
  checkedAt: number;
  /** Error if any */
  error?: string;
}
