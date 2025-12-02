import { ParallelWorkflow } from './parallel-workflow';
import { SequentialWorkflow } from './sequential-workflow';
import { SupervisorWorkflow } from './supervisor-workflow';
import { Workflow } from './workflow';
import { ToolRegistry } from '../tools/tool-registry';
import { WorkflowConfig, LLMProvider, MemoryStore } from '../types';

/**
 * Factory for creating workflow instances
 */
export class WorkflowFactory {
  /**
   * Create a workflow instance based on configuration
   */
  static create(
    config: WorkflowConfig,
    provider: LLMProvider,
    toolRegistry: ToolRegistry,
    memory?: MemoryStore,
  ): Workflow {
    switch (config.type) {
      case 'sequential':
        return new SequentialWorkflow(config, provider, toolRegistry, memory);

      case 'parallel':
        return new ParallelWorkflow(config, provider, toolRegistry, memory);

      case 'supervisor':
        return new SupervisorWorkflow(config, provider, toolRegistry, memory);

      case 'custom':
        throw new Error(
          'Custom workflows must be instantiated directly, not through the factory',
        );

      default:
        throw new Error(`Unknown workflow type: ${String(config.type)}`);
    }
  }
}
