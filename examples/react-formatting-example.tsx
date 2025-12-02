/**
 * Example React component using AgentSea formatting
 * This demonstrates how to use the @lov3kaizen/agentsea-react package
 */

import React, { useState } from 'react';
import {
  Agent,
  AnthropicProvider,
  ToolRegistry,
  AgentResponse as AgentResponseType,
} from '@lov3kaizen/agentsea-core';
import { AgentResponse, StreamingResponse } from '@lov3kaizen/agentsea-react';

// Sample CSS for styling (would typically be in a separate file)
const styles = `
  .agentsea-response {
    padding: 1rem;
    border-radius: 8px;
    background: #f5f5f5;
    margin: 1rem 0;
  }

  .agentsea-response[data-theme="dark"] {
    background: #1a1a1a;
    color: #e0e0e0;
  }

  .agentsea-metadata {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #ddd;
    font-size: 0.875rem;
    color: #666;
  }

  .metadata-item {
    display: flex;
    gap: 0.5rem;
  }

  .metadata-item .label {
    font-weight: 600;
  }

  .agentsea-content-metadata {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    background: #007bff;
    color: white;
    font-size: 0.75rem;
  }

  .agentsea-streaming-response {
    padding: 1rem;
    border-radius: 8px;
    background: #f5f5f5;
    margin: 1rem 0;
  }

  .streaming-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    color: #007bff;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #007bff;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .cursor {
    animation: blink 1s infinite;
  }

  @keyframes blink {
    0%, 49% { opacity: 1; }
    50%, 100% { opacity: 0; }
  }

  .agentsea-text-content {
    white-space: pre-wrap;
  }

  .agentsea-response code {
    background: #e0e0e0;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-family: monospace;
  }

  .agentsea-response pre {
    background: #2d2d2d;
    color: #f8f8f8;
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
  }

  .agentsea-response pre code {
    background: transparent;
    padding: 0;
  }

  .agentsea-response table {
    border-collapse: collapse;
    width: 100%;
    margin: 1rem 0;
  }

  .agentsea-response th,
  .agentsea-response td {
    border: 1px solid #ddd;
    padding: 0.5rem;
    text-align: left;
  }

  .agentsea-response th {
    background: #007bff;
    color: white;
  }
`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  response?: AgentResponseType;
}

export const FormattingDemo: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [format, setFormat] = useState<'text' | 'markdown' | 'html' | 'react'>(
    'markdown',
  );
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('light');
  const [showMetadata, setShowMetadata] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Create agent with selected format
      const provider = new AnthropicProvider({
        apiKey: process.env.ANTHROPIC_API_KEY || '',
      });
      const toolRegistry = new ToolRegistry();

      const agent = new Agent(
        {
          name: 'chat-agent',
          description: 'Chat agent with formatting',
          model: 'claude-3-5-sonnet-20241022',
          provider: 'anthropic',
          outputFormat: format,
          formatOptions: {
            includeMetadata: true,
            sanitizeHtml: true,
            highlightCode: true,
            theme,
          },
        },
        provider,
        toolRegistry,
      );

      const response = await agent.execute(input, {
        conversationId: 'demo-conv',
        sessionData: {},
        history: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      // Add assistant message
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.content,
        response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <style>{styles}</style>

      <h1>AgentSea Formatting Demo</h1>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ marginRight: '1rem' }}>
          Format:
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as any)}
            style={{ marginLeft: '0.5rem' }}
          >
            <option value="text">Text</option>
            <option value="markdown">Markdown</option>
            <option value="html">HTML</option>
            <option value="react">React</option>
          </select>
        </label>

        <label style={{ marginRight: '1rem' }}>
          Theme:
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as any)}
            style={{ marginLeft: '0.5rem' }}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </select>
        </label>

        <label>
          <input
            type="checkbox"
            checked={showMetadata}
            onChange={(e) => setShowMetadata(e.target.checked)}
            style={{ marginLeft: '0.5rem' }}
          />
          Show Metadata
        </label>
      </div>

      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '8px',
          minHeight: '400px',
          padding: '1rem',
        }}
      >
        {messages.map((message, index) => (
          <div key={index} style={{ marginBottom: '1rem' }}>
            <strong>{message.role === 'user' ? 'You' : 'Agent'}:</strong>
            {message.role === 'user' ? (
              <div style={{ marginLeft: '1rem' }}>{message.content}</div>
            ) : message.response ? (
              <AgentResponse
                response={message.response}
                showMetadata={showMetadata}
                theme={theme}
              />
            ) : (
              <div style={{ marginLeft: '1rem' }}>{message.content}</div>
            )}
          </div>
        ))}
        {isLoading && <div>Agent is thinking...</div>}
      </div>

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type your message..."
          style={{
            flex: 1,
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid #ddd',
          }}
          disabled={isLoading}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            border: 'none',
            background: '#007bff',
            color: 'white',
          }}
        >
          Send
        </button>
      </div>

      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          background: '#f0f0f0',
          borderRadius: '8px',
        }}
      >
        <h3>Try these prompts:</h3>
        <ul>
          <li>Create a table comparing cats and dogs</li>
          <li>
            Write a code example showing how to use promises in JavaScript
          </li>
          <li>List the top 5 benefits of TypeScript</li>
          <li>Explain recursion with a code example</li>
        </ul>
      </div>
    </div>
  );
};

// Streaming example
export const StreamingDemo: React.FC = () => {
  const [stream, setStream] = useState<AsyncIterable<any> | null>(null);
  const [input, setInput] = useState('');

  const startStream = async () => {
    if (!input.trim()) return;

    const provider = new AnthropicProvider({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });
    const toolRegistry = new ToolRegistry();

    const agent = new Agent(
      {
        name: 'streaming-agent',
        description: 'Streaming agent',
        model: 'claude-3-5-sonnet-20241022',
        provider: 'anthropic',
        outputFormat: 'markdown',
      },
      provider,
      toolRegistry,
    );

    const streamGenerator = agent.executeStream(input, {
      conversationId: 'streaming-conv',
      sessionData: {},
      history: [],
    });

    setStream(streamGenerator);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <style>{styles}</style>

      <h1>Streaming Response Demo</h1>

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && startStream()}
          placeholder="Type your message..."
          style={{
            flex: 1,
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid #ddd',
          }}
        />
        <button
          onClick={startStream}
          disabled={!input.trim()}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            border: 'none',
            background: '#007bff',
            color: 'white',
          }}
        >
          Stream
        </button>
      </div>

      {stream && (
        <StreamingResponse
          stream={stream}
          showMetadata={true}
          theme="light"
          onComplete={(content) => console.log('Stream complete:', content)}
        />
      )}
    </div>
  );
};

export default FormattingDemo;
