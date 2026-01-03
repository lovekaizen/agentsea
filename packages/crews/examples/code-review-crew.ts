/**
 * Code Review Crew Example
 *
 * Demonstrates using the pre-built CodeReviewCrew template.
 */

import {
  createCodeReviewCrew,
  CodeReviewTasks,
  createDebugMode,
} from '@lov3kaizen/agentsea-crews';

// Sample code to review
const sampleCode = `
async function fetchUserData(userId) {
  const response = await fetch('/api/users/' + userId);
  const data = await response.json();
  return data;
}

async function updateUser(userId, updates) {
  const query = "UPDATE users SET " + Object.keys(updates).map(k => k + "='" + updates[k] + "'").join(", ") + " WHERE id=" + userId;
  await db.execute(query);
  return true;
}

function calculateDiscount(price, discount) {
  if (discount > 0) {
    return price - (price * discount / 100);
  }
  return price;
}

async function processPayment(amount, cardNumber) {
  console.log('Processing payment for card:', cardNumber);
  const result = await paymentGateway.charge(amount, cardNumber);
  return result;
}
`;

async function main() {
  // Create a code review crew with all reviewers
  const crew = createCodeReviewCrew({
    name: 'security-review-crew',
    languages: ['javascript', 'typescript'],
    includeSecurity: true,
    includePerformance: true,
    strictness: 'strict',
  });

  // Create debug mode for step-through inspection
  const debugMode = createDebugMode(crew, {
    pauseOnError: true,
    verbose: true,
  });

  // Set breakpoint on security findings
  debugMode.setBreakpoint('task:completed', (event, _context) => {
    const anyEvent = event as Record<string, unknown>;
    return anyEvent.agentName === 'security-analyst';
  });

  // Add code review tasks
  crew.addTask(
    CodeReviewTasks.review(sampleCode, 'javascript', 'Backend API handlers'),
  );
  crew.addTask(CodeReviewTasks.securityReview(sampleCode, 'javascript'));
  crew.addTask(CodeReviewTasks.performanceReview(sampleCode, 'javascript'));

  console.log('Starting code review...\n');
  console.log('=== Code to Review ===');
  console.log(sampleCode);
  console.log('\n=== Review Process ===\n');

  // Run the crew
  for await (const event of crew.kickoffStream()) {
    switch (event.type) {
      case 'task:started':
        console.log(`\n[${event.agentName}] Starting review...`);
        break;

      case 'task:completed':
        console.log(`\n[${event.agentName}] Review complete:`);
        console.log('---');
        console.log(event.result);
        console.log('---');
        break;

      case 'delegation:decision':
        console.log(`Task delegated to ${event.toAgent}: ${event.reason}`);
        break;

      case 'crew:completed':
        console.log('\n=== Review Summary ===');
        console.log(`Total reviews: ${event.metrics?.completedTasks}`);
        console.log(`Success: ${event.success}`);
        break;
    }
  }

  // Get final status
  const status = crew.getStatus();
  console.log('\n=== Final Status ===');
  console.log(`State: ${status.state}`);
  console.log(`Tasks completed: ${status.tasksCompleted}`);
  console.log(`Tasks failed: ${status.tasksFailed}`);
}

// Run the example
main().catch(console.error);
