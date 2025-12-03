import {
  Agent,
  AnthropicProvider,
  ToolRegistry,
  ContentFormatter,
  OutputFormat,
} from '@lov3kaizen/agentsea-core';

/**
 * Example demonstrating different output formatting options
 */

async function main() {
  const provider = new AnthropicProvider({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  });

  const toolRegistry = new ToolRegistry();

  // Example 1: Text format (default, no formatting)
  console.log('\n=== Example 1: Text Format ===');
  const textAgent = new Agent(
    {
      name: 'text-agent',
      description: 'Agent that returns plain text',
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      outputFormat: 'text',
    },
    provider,
    toolRegistry,
  );

  const textResponse = await textAgent.execute(
    'Explain what a neural network is in 2 sentences.',
    {
      conversationId: 'conv-1',
      sessionData: {},
      history: [],
    },
  );

  console.log('Content:', textResponse.content);
  console.log('Formatted:', textResponse.formatted);

  // Example 2: Markdown format
  console.log('\n=== Example 2: Markdown Format ===');
  const markdownAgent = new Agent(
    {
      name: 'markdown-agent',
      description: 'Agent that returns markdown',
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      outputFormat: 'markdown',
      formatOptions: {
        includeMetadata: true,
      },
    },
    provider,
    toolRegistry,
  );

  const markdownResponse = await markdownAgent.execute(
    'Create a table comparing Python and JavaScript with 3 features.',
    {
      conversationId: 'conv-2',
      sessionData: {},
      history: [],
    },
  );

  console.log('Raw content:', markdownResponse.content);
  console.log('Format:', markdownResponse.formatted?.format);
  console.log('Has tables:', markdownResponse.formatted?.metadata?.hasTables);
  console.log('Rendered:', markdownResponse.formatted?.rendered);

  // Example 3: HTML format
  console.log('\n=== Example 3: HTML Format ===');
  const htmlAgent = new Agent(
    {
      name: 'html-agent',
      description: 'Agent that returns HTML',
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      outputFormat: 'html',
      formatOptions: {
        includeMetadata: true,
        sanitizeHtml: true,
        highlightCode: true,
        theme: 'dark',
      },
    },
    provider,
    toolRegistry,
  );

  const htmlResponse = await htmlAgent.execute(
    'Write a code example showing how to use async/await in JavaScript.',
    {
      conversationId: 'conv-3',
      sessionData: {},
      history: [],
    },
  );

  console.log('Raw markdown:', htmlResponse.content.substring(0, 200) + '...');
  console.log('Format:', htmlResponse.formatted?.format);
  console.log(
    'Has code blocks:',
    htmlResponse.formatted?.metadata?.hasCodeBlocks,
  );
  console.log(
    'Rendered HTML:',
    htmlResponse.formatted?.rendered?.substring(0, 300) + '...',
  );

  // Example 4: React format
  console.log('\n=== Example 4: React Format ===');
  const reactAgent = new Agent(
    {
      name: 'react-agent',
      description: 'Agent that returns React-compatible HTML',
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      outputFormat: 'react',
      formatOptions: {
        includeMetadata: true,
      },
    },
    provider,
    toolRegistry,
  );

  const reactResponse = await reactAgent.execute(
    'List 3 benefits of using TypeScript with examples.',
    {
      conversationId: 'conv-4',
      sessionData: {},
      history: [],
    },
  );

  console.log('Format:', reactResponse.formatted?.format);
  console.log('Has lists:', reactResponse.formatted?.metadata?.hasLists);
  console.log(
    'Has code blocks:',
    reactResponse.formatted?.metadata?.hasCodeBlocks,
  );
  console.log(
    'Rendered (with React data attributes):',
    reactResponse.formatted?.rendered?.substring(0, 300) + '...',
  );

  // Example 5: Manual formatting using ContentFormatter
  console.log('\n=== Example 5: Manual Formatting ===');
  const manualContent = `
# API Documentation

## Overview
This is a sample API.

\`\`\`javascript
fetch('/api/users')
  .then(res => res.json())
  .then(data => console.log(data));
\`\`\`

## Features
- Fast
- Reliable
- Secure

[Learn more](https://example.com)
  `;

  const formats: OutputFormat[] = ['text', 'markdown', 'html', 'react'];
  for (const format of formats) {
    const formatted = ContentFormatter.format(manualContent, format, {
      includeMetadata: true,
      sanitizeHtml: true,
    });

    console.log(`\nFormat: ${format}`);
    console.log('Metadata:', formatted.metadata);
  }

  // Example 6: Format detection
  console.log('\n=== Example 6: Format Detection ===');
  const samples = [
    'This is plain text',
    '# This is markdown',
    '<h1>This is HTML</h1>',
    '**Bold** and *italic*',
  ];

  for (const sample of samples) {
    const detected = ContentFormatter.detectFormat(sample);
    console.log(`"${sample}" -> Detected format: ${detected}`);
  }
}

// Run the examples
main().catch((error) => {
  console.error('Error running examples:', error);
  process.exit(1);
});
