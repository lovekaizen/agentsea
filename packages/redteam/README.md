# @lov3kaizen/agentsea-redteam

**AI Safety & Red Teaming Toolkit** - Proactive security testing for AI agents and LLM applications.

[![npm version](https://img.shields.io/npm/v/@lov3kaizen/agentsea-redteam.svg)](https://www.npmjs.com/package/@lov3kaizen/agentsea-redteam)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Attack Simulation** - Adversarial attack generation with mutation and combination strategies
- **Vulnerability Scanning** - Automated scanning for prompt injection, jailbreaks, and data leakage
- **Safety Benchmarks** - Evaluate agent safety against standard benchmarks
- **Jailbreak Detection** - Real-time detection of jailbreak attempts
- **Compliance Checking** - Verify compliance with AI safety regulations
- **Audit Logging** - Evidence collection and audit trails for security reviews
- **Continuous Testing** - Scheduled security testing with alerting
- **CI/CD Integration** - Run security tests in your CI pipeline
- **AgentSea Integration** - Direct integration with AgentSea agents

## Installation

```bash
pnpm add @lov3kaizen/agentsea-redteam
```

## Quick Start

```typescript
import {
  createRedTeam,
  createAttackLibrary,
  createVulnerabilityScanner,
} from '@lov3kaizen/agentsea-redteam';

// Create a red team instance
const redTeam = createRedTeam({
  config: {
    target: {
      type: 'agent',
      name: 'my-agent',
      endpoint: 'https://api.example.com/chat',
    },
  },
});

// Run security tests
const results = await redTeam.run();
console.log('Risk Score:', results.summary.riskScore);
console.log('Vulnerabilities:', results.summary.vulnerabilities);
```

## Attack Library

Generate and manage adversarial attacks:

```typescript
import {
  createAttackLibrary,
  createAttackRegistry,
  createMutationGenerator,
  createCombinationGenerator,
  createAdversarialGenerator,
} from '@lov3kaizen/agentsea-redteam';

// Use the default attack library
const library = createAttackLibrary();

// Create mutation-based attacks
const mutator = createMutationGenerator({
  strategies: ['character-swap', 'encoding', 'obfuscation'],
});

// Combine attack strategies
const combiner = createCombinationGenerator({
  strategies: ['sequential', 'nested', 'layered'],
});

// Generate adversarial inputs
const adversarial = createAdversarialGenerator({
  strategies: ['roleplay', 'hypothetical', 'translation'],
});
```

## Vulnerability Scanning

Scan your agents for common vulnerabilities:

```typescript
import {
  createVulnerabilityScanner,
  createPromptAnalyzer,
  createSystemPromptAudit,
} from '@lov3kaizen/agentsea-redteam';

// Comprehensive vulnerability scan
const scanner = createVulnerabilityScanner({
  target: myAgent,
  categories: ['injection', 'jailbreak', 'data-leakage', 'bias'],
});

const scanResults = await scanner.scan();

// Analyze prompt safety
const analyzer = createPromptAnalyzer();
const analysis = await analyzer.analyze('Your system prompt here');

// Audit system prompt
const audit = createSystemPromptAudit();
const auditResults = await audit.audit(systemPrompt);
```

## Jailbreak Detection

Detect jailbreak attempts in real-time:

```typescript
import { createJailbreakDetector } from '@lov3kaizen/agentsea-redteam';

const detector = createJailbreakDetector({
  sensitivity: 'high',
});

const result = await detector.detect('Ignore all previous instructions...');
console.log('Is jailbreak:', result.isJailbreak);
console.log('Confidence:', result.confidence);
console.log('Category:', result.category);
```

## Compliance Checking

Verify compliance with AI regulations:

```typescript
import { ComplianceChecker } from '@lov3kaizen/agentsea-redteam';

const checker = new ComplianceChecker({
  frameworks: ['eu-ai-act', 'nist-ai-rmf'],
});

const compliance = await checker.check(myAgent);
console.log('Compliant:', compliance.isCompliant);
console.log('Findings:', compliance.findings);
```

## Audit & Evidence

Collect evidence and maintain audit trails:

```typescript
import { AuditLogger, EvidenceCollector } from '@lov3kaizen/agentsea-redteam';

const auditLogger = new AuditLogger({ storage: 'sqlite' });
const evidenceCollector = new EvidenceCollector();

// Log security events
auditLogger.log({
  event: 'vulnerability-found',
  severity: 'high',
  details: { type: 'prompt-injection', category: 'direct' },
});

// Collect evidence
evidenceCollector.capture({
  input: attackInput,
  output: agentResponse,
  timestamp: Date.now(),
});
```

## Continuous Testing

Schedule automated security tests:

```typescript
import {
  ContinuousTesting,
  Scheduler,
  AlertManager,
} from '@lov3kaizen/agentsea-redteam';

const continuous = new ContinuousTesting({
  scheduler: new Scheduler({ cron: '0 */6 * * *' }), // Every 6 hours
  alertManager: new AlertManager({
    channels: ['slack', 'email'],
    threshold: 'medium',
  }),
});

continuous.start();
```

## CI/CD Integration

Run security tests in your CI pipeline:

```typescript
import { createCIIntegration } from '@lov3kaizen/agentsea-redteam';

const ci = createCIIntegration({
  failOnHighSeverity: true,
  reportFormat: 'junit',
  outputPath: './security-report.xml',
});

const results = await ci.run();
process.exit(results.passed ? 0 : 1);
```

## AgentSea Integration

```typescript
import { createAgentSeaIntegration } from '@lov3kaizen/agentsea-redteam';
import {
  Agent,
  AnthropicProvider,
  ToolRegistry,
} from '@lov3kaizen/agentsea-core';

const agent = new Agent(
  { name: 'my-agent', model: 'claude-sonnet-4-6', provider: 'anthropic' },
  new AnthropicProvider(process.env.ANTHROPIC_API_KEY),
  new ToolRegistry(),
);

const integration = createAgentSeaIntegration({
  agent,
  testCategories: ['injection', 'jailbreak', 'data-leakage'],
});

const results = await integration.run();
```

## Test Suites

Build custom test suites:

```typescript
import {
  createTestSuite,
  TestSuiteBuilder,
} from '@lov3kaizen/agentsea-redteam';

const suite = new TestSuiteBuilder()
  .addAttack('prompt-injection')
  .addAttack('jailbreak')
  .addScan('system-prompt')
  .addBenchmark('safety')
  .build();

const results = await suite.run({ target: myAgent });
```

## Report Generation

Generate detailed security reports:

```typescript
import { createReportGenerator } from '@lov3kaizen/agentsea-redteam';

const reporter = createReportGenerator({
  format: 'html',
  branding: { logo: './logo.png', company: 'Acme Corp' },
  sections: ['executive-summary', 'methodology', 'findings', 'recommendations'],
});

const report = await reporter.generate(results);
```

## Sub-Package Imports

```typescript
// Import specific modules
import { RedTeam } from '@lov3kaizen/agentsea-redteam/core';
import { AttackLibrary } from '@lov3kaizen/agentsea-redteam/attacks';
import { VulnerabilityScanner } from '@lov3kaizen/agentsea-redteam/scanning';
import { SafetyBenchmark } from '@lov3kaizen/agentsea-redteam/benchmarks';
import { JailbreakDetector } from '@lov3kaizen/agentsea-redteam/detection';
import { ComplianceChecker } from '@lov3kaizen/agentsea-redteam/compliance';
import { AuditLogger } from '@lov3kaizen/agentsea-redteam/audit';
import { ContinuousTesting } from '@lov3kaizen/agentsea-redteam/continuous';
```

## License

MIT License - see [LICENSE](../../LICENSE) for details
