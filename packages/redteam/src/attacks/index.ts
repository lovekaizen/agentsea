/**
 * Attacks Module - Red Team Attack Library
 *
 * Comprehensive attack library for AI security testing including
 * jailbreaks, prompt injections, data exfiltration, and more.
 */

// Attack library
export {
  AttackLibrary,
  createAttackLibrary,
  defaultAttackLibrary,
} from './AttackLibrary.js';

// Attack registry
export {
  AttackRegistry,
  createAttackRegistry,
  defaultAttackRegistry,
  type AttackRegistryEvents,
  type AttackExecutor,
  type AttackValidator,
  type AttackRegistryConfig,
} from './AttackRegistry.js';

// Generators
export * from './generators/index.js';
