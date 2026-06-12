# @lov3kaizen/agentsea-crews

A TypeScript-native multi-agent orchestration framework for building AI agent teams. Inspired by CrewAI and AutoGen, this package provides role-based agent coordination, task delegation strategies, workflow building capabilities, and pre-built crew templates.

## Features

- **Role-Based Agents**: Define agents with specific roles, capabilities, and goals
- **Multiple Delegation Strategies**: Round-robin, best-match, auction, hierarchical, and consensus
- **Workflow Builder**: Fluent API for building complex workflows with DAG execution
- **Memory Systems**: Shared memory, conversation history, and knowledge base
- **Monitoring & Debug**: Real-time dashboard and step-through debugging
- **Pre-built Templates**: Research, writing, code review, and customer support crews
- **NestJS Integration**: Decorators and dynamic modules for NestJS apps

## Installation

```bash
npm install @lov3kaizen/agentsea-crews
# or
pnpm add @lov3kaizen/agentsea-crews
```

## Quick Start

### Basic Crew

```typescript
import {
  createCrew,
  type CrewConfig,
  type RoleConfig,
} from '@lov3kaizen/agentsea-crews';

// Define a role
const researcherRole: RoleConfig = {
  name: 'Researcher',
  description: 'Expert at finding and synthesizing information',
  capabilities: [
    { name: 'web-search', proficiency: 'expert' },
    { name: 'analysis', proficiency: 'advanced' },
  ],
  systemPrompt: 'You are a skilled researcher...',
  goals: ['Find accurate information'],
};

// Create crew configuration
const config: CrewConfig = {
  name: 'my-crew',
  agents: [
    {
      name: 'researcher',
      role: researcherRole,
      model: 'claude-sonnet-4-6',
      provider: 'anthropic',
    },
  ],
  delegationStrategy: 'best-match',
};

// Create and run the crew
const crew = createCrew(config);

crew.addTask({
  description: 'Research AI trends',
  expectedOutput: 'Summary of AI trends',
  priority: 'high',
});

const result = await crew.kickoff();
console.log(result.finalOutput);
```

### Using Templates

```typescript
import { createResearchCrew, ResearchTasks } from '@lov3kaizen/agentsea-crews';

// Create a research crew with pre-configured agents
const crew = createResearchCrew({
  depth: 'deep',
  includeWriter: true,
});

// Add tasks using templates
crew.addTask(ResearchTasks.research('electric vehicles', 'deep'));
crew.addTask(ResearchTasks.writeReport('EV Market Analysis', 'executive'));

const result = await crew.kickoff();
```

### Workflow Builder

```typescript
import {
  workflow,
  createDAGExecutor,
  createDAGFromSteps,
} from '@lov3kaizen/agentsea-crews';

const workflowDef = workflow('data-pipeline')
  .addStep('fetch', async (ctx) => {
    // Fetch data
    return { output: 'data', success: true };
  })
  .parallel(
    { name: 'validate', handler: validateFn },
    { name: 'transform', handler: transformFn },
  )
  .when((ctx) => ctx.getVariable('needsReview'))
  .then((b) => b.addStep('review', reviewFn))
  .otherwise((b) => b.addStep('auto-approve', approveFn))
  .endBranch()
  .build();

const dag = createDAGFromSteps(workflowDef.steps, workflowDef.handlers);
const executor = createDAGExecutor(dag, workflowDef.handlers);
const result = await executor.execute(context);
```

## Core Concepts

### Roles & Capabilities

Roles define what an agent is and what it can do:

```typescript
const role: RoleConfig = {
  name: 'Security Analyst',
  description: 'Expert at identifying security vulnerabilities',
  capabilities: [
    { name: 'vulnerability-detection', proficiency: 'expert' },
    { name: 'secure-coding', proficiency: 'advanced' },
  ],
  systemPrompt: 'You are a security expert...',
  goals: ['Identify vulnerabilities', 'Ensure secure code'],
  constraints: ['Flag all security concerns'],
};
```

### Delegation Strategies

Choose how tasks are assigned to agents:

- **round-robin**: Cycle through agents sequentially
- **best-match**: Match tasks to agents by capabilities
- **auction**: Agents bid on tasks based on confidence
- **hierarchical**: Manager delegates to workers
- **consensus**: Multi-agent voting for task assignment

```typescript
const crew = createCrew({
  delegationStrategy: 'consensus',
  // ...
});
```

### Memory Systems

Share state and knowledge across agents:

```typescript
import {
  createSharedMemory,
  createKnowledgeBase,
} from '@lov3kaizen/agentsea-crews';

// Shared memory for crew-wide state
const memory = createSharedMemory();
memory.setShared('key', 'value');

// Knowledge base for persistent knowledge
const kb = createKnowledgeBase();
kb.addFact('title', 'content', ['tag1', 'tag2']);
const results = kb.search('query');
```

### Monitoring

Monitor crew execution in real-time:

```typescript
import { createDashboard, createDebugMode } from '@lov3kaizen/agentsea-crews';

// Dashboard for monitoring
const dashboard = createDashboard(crew);
dashboard.subscribe((update) => {
  console.log('Progress:', dashboard.getProgress());
});

// Debug mode for step-through debugging
const debug = createDebugMode(crew);
debug.setBreakpoint('task:completed');
debug.enable();

const stepResult = await debug.step();
```

## Pre-built Templates

### Research Crew

```typescript
import { createResearchCrew, ResearchTasks } from '@lov3kaizen/agentsea-crews';

const crew = createResearchCrew({
  depth: 'standard', // 'shallow' | 'standard' | 'deep'
});
```

### Writing Crew

```typescript
import { createWritingCrew, WritingTasks } from '@lov3kaizen/agentsea-crews';

const crew = createWritingCrew({
  contentType: 'blog', // 'blog' | 'technical' | 'marketing'
});
```

### Code Review Crew

```typescript
import {
  createCodeReviewCrew,
  CodeReviewTasks,
} from '@lov3kaizen/agentsea-crews';

const crew = createCodeReviewCrew({
  languages: ['typescript', 'python'],
  strictness: 'strict',
});
```

### Customer Support Crew

```typescript
import {
  createCustomerSupportCrew,
  CustomerSupportTasks,
} from '@lov3kaizen/agentsea-crews';

const crew = createCustomerSupportCrew({
  productName: 'MyApp',
  supportStyle: 'friendly',
});
```

## NestJS Integration

```typescript
import { Module } from '@nestjs/common';
import {
  CrewsModule,
  CrewsService,
  InjectCrew,
  OnCrewEvent,
} from '@lov3kaizen/agentsea-crews/nestjs';

@Module({
  imports: [
    CrewsModule.forRoot({
      crews: [myCrewConfig],
      enableMonitoring: true,
    }),
  ],
})
export class AppModule {}

@Injectable()
export class MyService {
  constructor(
    private readonly crewsService: CrewsService,
    @InjectCrew('my-crew') private readonly myCrew: Crew,
  ) {}

  @OnCrewEvent('task:completed')
  handleTaskCompleted(event: CrewEvent) {
    console.log('Task completed:', event);
  }
}
```

## API Reference

### Core Classes

- `Crew` - Main orchestrator for multi-agent crews
- `Role` - Agent role definitions
- `Task` - Task lifecycle management
- `TaskQueue` - Priority-based task queue
- `ExecutionContext` - Shared execution context

### Agents

- `CrewAgent` - Enhanced agent with crew capabilities
- `AgentCapabilities` - Capability matching utilities
- `AgentRegistry` - Agent discovery and management

### Coordination

- `DelegationCoordinator` - Manages delegation strategies
- `CollaborationManager` - Agent-to-agent communication
- `ConflictResolver` - Handles disagreements

### Workflows

- `WorkflowBuilder` - Fluent API for workflows
- `DAGExecutor` - DAG execution engine
- `ParallelExecutor` - Concurrent task execution
- `CheckpointManager` - Workflow state persistence

### Memory

- `SharedMemory` - Crew-wide shared state
- `ConversationHistory` - Multi-agent conversation tracking
- `KnowledgeBase` - Persistent knowledge store

### Monitoring

- `CrewDashboard` - Real-time monitoring
- `DebugMode` - Step-through debugging

## License

MIT
