/**
 * Basic Crew Example
 *
 * Demonstrates creating and running a simple multi-agent crew.
 */

import {
  createCrew,
  type CrewConfig,
  type RoleConfig,
} from '@lov3kaizen/agentsea-crews';

// Define roles
const researcherRole: RoleConfig = {
  name: 'Researcher',
  description: 'Expert at finding and synthesizing information',
  capabilities: [
    { name: 'web-search', proficiency: 'expert' },
    { name: 'analysis', proficiency: 'advanced' },
  ],
  systemPrompt: `You are a skilled researcher. Find relevant information and provide comprehensive analysis.`,
  goals: ['Find accurate information', 'Provide thorough analysis'],
};

const writerRole: RoleConfig = {
  name: 'Writer',
  description: 'Expert at creating clear, engaging content',
  capabilities: [
    { name: 'writing', proficiency: 'expert' },
    { name: 'editing', proficiency: 'advanced' },
  ],
  systemPrompt: `You are a skilled writer. Create clear, engaging content based on provided information.`,
  goals: ['Create compelling content', 'Ensure clarity and accuracy'],
};

// Create crew configuration
const crewConfig: CrewConfig = {
  name: 'content-creation-crew',
  description: 'A crew for researching and writing content',
  agents: [
    {
      name: 'researcher',
      role: researcherRole,
      model: 'claude-sonnet-4-6',
      provider: 'anthropic',
      tools: ['web-search'],
      temperature: 0.3,
    },
    {
      name: 'writer',
      role: writerRole,
      model: 'claude-sonnet-4-6',
      provider: 'anthropic',
      tools: ['text-editor'],
      temperature: 0.7,
    },
  ],
  delegationStrategy: 'best-match',
  maxIterations: 20,
};

async function main() {
  // Create the crew
  const crew = createCrew(crewConfig);

  // Add tasks
  crew.addTask({
    description: 'Research the latest trends in artificial intelligence',
    expectedOutput: 'A comprehensive summary of AI trends',
    priority: 'high',
    requiredCapabilities: ['web-search', 'analysis'],
  });

  crew.addTask({
    description: 'Write a blog post about AI trends based on the research',
    expectedOutput: 'An engaging blog post about AI trends',
    priority: 'medium',
    requiredCapabilities: ['writing'],
    dependencies: ['task-1'], // Depends on research task
  });

  console.log('Starting crew execution...\n');

  // Run the crew with streaming events
  for await (const event of crew.kickoffStream()) {
    switch (event.type) {
      case 'crew:started':
        console.log(
          `Crew "${event.crewName}" started with ${event.agentCount} agents`,
        );
        break;

      case 'task:assigned':
        console.log(
          `Task assigned to ${event.agentName}: ${event.taskDescription}`,
        );
        break;

      case 'task:completed':
        console.log(`Task completed by ${event.agentName}`);
        console.log(`Result: ${event.result?.substring(0, 200)}...`);
        break;

      case 'crew:completed':
        console.log(`\nCrew completed!`);
        console.log(`Success: ${event.success}`);
        console.log(`Metrics:`, event.metrics);
        break;

      case 'crew:error':
        console.error(`Crew error: ${event.error}`);
        break;
    }
  }
}

// Run the example
main().catch(console.error);
