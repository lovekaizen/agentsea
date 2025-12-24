/**
 * Coordination Module
 *
 * Task delegation, agent collaboration, and conflict resolution.
 */

// Delegation strategies
export * from './strategies';

// Delegation coordinator
export {
  DelegationCoordinator,
  createDelegationCoordinator,
  type DelegationCoordinatorConfig,
  type DelegationHistoryEntry,
} from './Delegation';

// Collaboration
export {
  CollaborationManager,
  createCollaborationManager,
  type CollaborationConfig,
  type CollaborationMessage,
  type CollaborationMessageType,
  type CollaborationChannel,
  type HelpRequest,
  type HelpResponse,
  type Knowledge,
} from './Collaboration';

// Conflict resolution
export {
  ConflictResolver,
  createConflictResolver,
  type ConflictResolverConfig,
  type Conflict,
  type ConflictType,
  type Resolution,
  type ResolutionStrategy,
  type AgentResponse,
} from './ConflictResolution';
