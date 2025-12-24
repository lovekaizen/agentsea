/**
 * Audit Module - Logging and Evidence Collection
 *
 * Comprehensive audit logging, evidence collection, and
 * chain of custody management for security testing.
 */

// Re-export types
export type {
  AuditEntry,
  AuditEventType,
  AuditActor,
  AuditResource,
  AuditTrail,
  AuditTrailSummary,
  AuditLogConfig,
  AuditStorageConfig,
  AuditRetentionPolicy,
  AuditQuery,
  AuditQueryResult,
  EvidenceCollectionConfig,
  EvidenceCollectionType,
  EvidencePackage,
  EvidencePackageSummary,
  AuditReportConfig,
  AuditReportSection,
  AuditReport,
  ChainOfCustodyRecord,
  AuditIntegrityCheckResult,
} from '../types/audit.types.js';

/**
 * Placeholder for AuditLogger implementation
 * TODO: Implement full audit logger
 */
export class AuditLogger {
  constructor(public readonly config: { enabled: boolean }) {}
}

/**
 * Placeholder for EvidenceCollector implementation
 * TODO: Implement full evidence collector
 */
export class EvidenceCollector {
  constructor(public readonly config: { enabled: boolean }) {}
}
