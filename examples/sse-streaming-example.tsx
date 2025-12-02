/**
 * Server-Sent Events (SSE) Streaming Example
 * Demonstrates real-time streaming of agent responses using SSE
 */

// ============================================
// Server Setup (same as REST API example)
// ============================================

import { Module } from '@nestjs/common';
import { AgenticModule } from '@lov3kaizen/agentsea-nestjs';

@Module({
  imports: [
    AgenticModule.forRoot({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      enableRestApi: true, // SSE is part of REST API
    }),
  ],
})
export class AppModule {}

// ============================================
// Client-side SSE streaming examples
// ============================================

/**
 * Example 1: Basic SSE streaming with EventSource (Browser)
 */
function streamAgentResponseBrowser() {
  // Note: EventSource only supports GET requests
  // For POST data, you'd need to pass it as query parameters or use fetch with ReadableStream

  const eventSource = new EventSource(
    'http://localhost:3000/agents/customer-support/stream',
  );

  let fullResponse = '';

  eventSource.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case 'iteration':
        console.log(`Starting iteration ${data.iteration}`);
        break;

      case 'content':
        // Accumulate content chunks
        fullResponse += data.content;
        console.log('Received content:', data.content);

        // Update UI in real-time
        document.getElementById('response').textContent = fullResponse;
        break;

      case 'tool_calls':
        console.log('Agent is using tools:', data.toolCalls);
        break;

      case 'tool_result':
        console.log('Tool result:', data.toolCall);
        break;

      case 'done':
        console.log('Streaming complete!', data.metadata);
        eventSource.close();
        break;

      case 'error':
        console.error('Error:', data.error);
        eventSource.close();
        break;
    }
  });

  eventSource.addEventListener('error', (error) => {
    console.error('SSE Error:', error);
    eventSource.close();
  });
}

/**
 * Example 2: SSE streaming with fetch API (Node.js/Browser)
 */
async function streamWithFetch() {
  const response = await fetch(
    'http://localhost:3000/agents/customer-support/stream',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        input: 'Explain quantum computing in simple terms',
        conversationId: 'stream-demo-1',
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error('Response body is null');
  }

  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      console.log('Stream complete!');
      break;
    }

    // Decode the chunk
    const chunk = decoder.decode(value, { stream: true });

    // Parse SSE format (data: {json}\n\n)
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.substring(6));

        if (data.type === 'content') {
          fullContent += data.content;
          console.log('Delta:', data.content);

          // Call a callback to update UI
          onContentUpdate(fullContent);
        } else if (data.type === 'done') {
          console.log('Metadata:', data.metadata);
          onStreamComplete(fullContent, data.metadata);
        }
      }
    }
  }

  return fullContent;
}

/**
 * Example 3: React component using SSE streaming
 */
import { useState, useEffect } from 'react';

function StreamingChatComponent() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);

  const sendMessage = async () => {
    setIsStreaming(true);
    setResponse('');

    try {
      const res = await fetch(
        'http://localhost:3000/agents/customer-support/stream',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            input: message,
            conversationId: 'react-chat-' + Date.now(),
          }),
        },
      );

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));

            if (data.type === 'content') {
              setResponse((prev) => prev + data.content);
            } else if (data.type === 'done') {
              setMetadata(data.metadata);
              setIsStreaming(false);
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error);
      setIsStreaming(false);
    }
  };

  return (
    <div>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your message..."
      />
      <button onClick={sendMessage} disabled={isStreaming}>
        {isStreaming ? 'Streaming...' : 'Send'}
      </button>

      <div className="response">
        <h3>Agent Response:</h3>
        <p>{response}</p>
        {metadata && (
          <small>
            Tokens: {metadata.tokensUsed} | Time: {metadata.latencyMs}ms
          </small>
        )}
      </div>
    </div>
  );
}

/**
 * Example 4: Node.js client using EventSource polyfill
 */
async function nodeJsSSEClient() {
  // Install: npm install eventsource
  const EventSource = require('eventsource');

  const url = new URL('http://localhost:3000/agents/code-assistant/stream');

  // Since EventSource only supports GET, encode data in URL
  url.searchParams.set(
    'data',
    JSON.stringify({
      input: 'Write a TypeScript function to calculate factorial',
      conversationId: 'node-client-1',
    }),
  );

  const eventSource = new EventSource(url.toString());

  eventSource.onmessage = (event: any) => {
    const data = JSON.parse(event.data);

    if (data.type === 'content') {
      process.stdout.write(data.content); // Stream to console
    } else if (data.type === 'done') {
      console.log('\n\nComplete!', data.metadata);
      eventSource.close();
    }
  };

  eventSource.onerror = (error: any) => {
    console.error('Error:', error);
    eventSource.close();
  };
}

/**
 * Example 5: Vanilla JavaScript with progress tracking
 */
async function streamWithProgressTracking() {
  const response = await fetch(
    'http://localhost:3000/agents/customer-support/stream',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        input: 'Write a detailed analysis of renewable energy trends',
      }),
    },
  );

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) return;

  let content = '';
  let currentIteration = 0;
  const toolCalls: any[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const event = JSON.parse(line.substring(6));

        switch (event.type) {
          case 'iteration':
            currentIteration = event.iteration;
            updateProgress(`Iteration ${currentIteration}`);
            break;

          case 'content':
            content += event.content;
            updateContent(content);
            break;

          case 'tool_calls':
            toolCalls.push(...event.toolCalls);
            updateToolCalls(toolCalls);
            break;

          case 'tool_result':
            console.log('Tool executed:', event.toolCall.tool);
            break;

          case 'done':
            showMetrics(event.metadata);
            break;
        }
      }
    }
  }
}

// Helper functions for UI updates
function onContentUpdate(content: string) {
  console.log('Current content length:', content.length);
}

function onStreamComplete(content: string, metadata: any) {
  console.log('Final content:', content);
  console.log('Metrics:', metadata);
}

function updateProgress(message: string) {
  console.log('Progress:', message);
}

function updateContent(content: string) {
  // Update UI element
  const element = document.getElementById('streaming-content');
  if (element) {
    element.textContent = content;
  }
}

function updateToolCalls(toolCalls: any[]) {
  console.log('Active tool calls:', toolCalls.length);
}

function showMetrics(metadata: any) {
  console.log('Performance metrics:', metadata);
}

// Export examples
export {
  streamAgentResponseBrowser,
  streamWithFetch,
  StreamingChatComponent,
  nodeJsSSEClient,
  streamWithProgressTracking,
};
