/**
 * Delegation Strategies
 *
 * Various strategies for assigning tasks to agents in a crew.
 */

// Base strategy interface and class
export {
  type DelegationStrategy,
  type DelegationResult,
  type DelegationFailure,
  BaseDelegationStrategy,
  DelegationError,
} from './DelegationStrategy';

// Strategy implementations
export {
  RoundRobinStrategy,
  createRoundRobinStrategy,
  type RoundRobinConfig,
} from './RoundRobin';

export {
  BestMatchStrategy,
  createBestMatchStrategy,
  type BestMatchConfig,
} from './BestMatch';

export {
  AuctionStrategy,
  createAuctionStrategy,
  type AuctionConfig,
} from './Auction';

export {
  HierarchicalStrategy,
  createHierarchicalStrategy,
  type HierarchicalConfig,
  type AgentHierarchy,
} from './Hierarchical';

export {
  ConsensusStrategy,
  createConsensusStrategy,
  type ConsensusConfig,
  type Vote,
  type VotingRound,
} from './Consensus';

// Strategy factory
import { RoundRobinStrategy } from './RoundRobin';
import { BestMatchStrategy } from './BestMatch';
import { AuctionStrategy } from './Auction';
import { HierarchicalStrategy } from './Hierarchical';
import { ConsensusStrategy } from './Consensus';
import type { DelegationStrategy } from './DelegationStrategy';
import type { DelegationStrategyType } from '../../types';

/**
 * Create a delegation strategy by type
 */
export function createStrategy(
  type: DelegationStrategyType,
  config?: Record<string, unknown>,
): DelegationStrategy {
  switch (type) {
    case 'round-robin':
      return new RoundRobinStrategy(config);
    case 'best-match':
      return new BestMatchStrategy(config);
    case 'auction':
      return new AuctionStrategy(config);
    case 'hierarchical':
      return new HierarchicalStrategy(config);
    case 'consensus':
      return new ConsensusStrategy(config);
    default:
      throw new Error(`Unknown delegation strategy type: ${String(type)}`);
  }
}

/**
 * All available strategy types
 */
export const STRATEGY_TYPES: DelegationStrategyType[] = [
  'round-robin',
  'best-match',
  'auction',
  'hierarchical',
  'consensus',
];
