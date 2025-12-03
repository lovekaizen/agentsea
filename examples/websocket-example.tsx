/**
 * WebSocket Streaming Example
 * Demonstrates bidirectional real-time communication with agents using WebSockets
 */

// ============================================
// Server Setup
// ============================================

import { Module } from '@nestjs/common';
import { AgenticModule } from '@lov3kaizen/agentsea-nestjs';

@Module({
  imports: [
    AgenticModule.forRoot({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      enableWebSocket: true,
    }),
  ],
})
export class AppModule {}

// ============================================
// Client-side WebSocket examples
// ============================================

/**
 * Example 1: Basic WebSocket client (Browser/Node.js)
 */
import { io } from 'socket.io-client';

function basicWebSocketClient() {
  // Connect to the agents namespace
  const socket = io('http://localhost:3000/agents');

  socket.on('connect', () => {
    console.log('✅ Connected to agent WebSocket server');

    // Execute an agent
    socket.emit('execute', {
      agentName: 'customer-support',
      input: 'Hello! I need help with my account.',
      conversationId: 'ws-conv-123',
      userId: 'user-456',
      sessionData: {
        plan: 'premium',
      },
    });
  });

  // Listen for streaming events
  socket.on('stream', (event) => {
    switch (event.type) {
      case 'iteration':
        console.log(`⚙️  Iteration ${event.iteration}`);
        break;

      case 'content':
        console.log('📝', event.content);
        break;

      case 'tool_calls':
        console.log(
          '🔧 Using tools:',
          event.toolCalls.map((t: any) => t.tool),
        );
        break;

      case 'tool_result':
        console.log('✅ Tool completed:', event.toolCall.tool);
        break;

      case 'done':
        console.log('🎉 Complete!', event.metadata);
        break;

      case 'error':
        console.error('❌ Error:', event.error);
        break;
    }
  });

  socket.on('complete', (data) => {
    console.log('Conversation ID:', data.conversationId);
  });

  socket.on('error', (error) => {
    console.error('Error:', error);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });

  return socket;
}

/**
 * Example 2: React component with WebSocket streaming
 */
import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

function WebSocketChatComponent() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const conversationId = useRef(`conv-${Date.now()}`);

  useEffect(() => {
    // Initialize socket connection
    const socket = io('http://localhost:3000/agents');

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to agent server');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Handle streaming events
    socket.on('stream', (event) => {
      if (event.type === 'content') {
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];

          // Append to last message if it's from assistant
          if (lastMessage && lastMessage.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              {
                ...lastMessage,
                content: lastMessage.content + event.content,
              },
            ];
          }

          // Create new assistant message
          return [
            ...prev,
            {
              role: 'assistant',
              content: event.content,
            },
          ];
        });
      } else if (event.type === 'done') {
        setIsStreaming(false);
      }
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
      setIsStreaming(false);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const sendMessage = () => {
    if (!socketRef.current || !input.trim()) return;

    // Add user message to UI
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: input,
      },
    ]);

    setIsStreaming(true);

    // Send to agent
    socketRef.current.emit('execute', {
      agentName: 'customer-support',
      input: input,
      conversationId: conversationId.current,
      userId: 'user-123',
    });

    setInput('');
  };

  return (
    <div className="chat-container">
      <div className="connection-status">
        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
        {isStreaming && (
          <div className="typing-indicator">Agent is typing...</div>
        )}
      </div>

      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type your message..."
          disabled={!isConnected || isStreaming}
        />
        <button
          onClick={sendMessage}
          disabled={!isConnected || isStreaming || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}

/**
 * Example 3: Multi-agent orchestration via WebSocket
 */
function multiAgentWebSocket() {
  const socket = io('http://localhost:3000/agents');

  socket.on('connect', () => {
    // First, list available agents
    socket.emit('listAgents');
  });

  socket.on('agentList', (data) => {
    console.log('Available agents:', data.agents);

    // Execute different agents based on task
    const agents = data.agents;

    if (agents.some((a: any) => a.name === 'code-assistant')) {
      socket.emit('execute', {
        agentName: 'code-assistant',
        input: 'Review this code for security issues',
        conversationId: 'code-review-1',
      });
    }
  });

  // Handle responses from different agents
  socket.on('stream', (event) => {
    if (event.type === 'content') {
      console.log('Response:', event.content);
    }
  });

  return socket;
}

/**
 * Example 4: WebSocket with authentication
 */
function authenticatedWebSocket(authToken: string) {
  const socket = io('http://localhost:3000/agents', {
    auth: {
      token: authToken,
    },
    extraHeaders: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  socket.on('connect', () => {
    console.log('Authenticated connection established');
  });

  socket.on('connect_error', (error) => {
    console.error('Authentication failed:', error);
  });

  return socket;
}

/**
 * Example 5: Advanced WebSocket client with reconnection and state management
 */
class AgentWebSocketClient {
  private socket: Socket | null = null;
  private conversationId: string;
  private messageHandlers: Map<string, (event: any) => void> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(
    private serverUrl: string,
    conversationId?: string,
  ) {
    this.conversationId = conversationId || `conv-${Date.now()}`;
    this.connect();
  }

  private connect() {
    this.socket = io(`${this.serverUrl}/agents`, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Connected to agent server');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);

      if (reason === 'io server disconnect') {
        // Server disconnected the client, manual reconnect needed
        this.socket?.connect();
      }
    });

    this.socket.on('stream', (event) => {
      // Trigger registered handlers
      this.messageHandlers.forEach((handler) => handler(event));
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    this.socket.on('connect_error', () => {
      this.reconnectAttempts++;
      console.log(
        `Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`,
      );
    });
  }

  // Register a message handler
  onMessage(id: string, handler: (event: any) => void) {
    this.messageHandlers.set(id, handler);
  }

  // Unregister a message handler
  offMessage(id: string) {
    this.messageHandlers.delete(id);
  }

  // Execute an agent
  execute(
    agentName: string,
    input: string,
    options?: {
      userId?: string;
      sessionData?: Record<string, any>;
      metadata?: Record<string, any>;
    },
  ) {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('execute', {
      agentName,
      input,
      conversationId: this.conversationId,
      ...options,
    });
  }

  // Get agent information
  getAgent(agentName: string) {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('getAgent', { agentName });

    return new Promise((resolve) => {
      this.socket?.once('agentInfo', (info) => {
        resolve(info);
      });
    });
  }

  // List all agents
  listAgents() {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('listAgents');

    return new Promise((resolve) => {
      this.socket?.once('agentList', (data) => {
        resolve(data.agents);
      });
    });
  }

  // Disconnect
  disconnect() {
    this.socket?.disconnect();
    this.messageHandlers.clear();
  }

  // Check connection status
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

/**
 * Example usage of the AgentWebSocketClient
 */
async function useAgentClient() {
  const client = new AgentWebSocketClient('http://localhost:3000');

  // Register message handler
  client.onMessage('main', (event) => {
    if (event.type === 'content') {
      console.log('Content:', event.content);
    } else if (event.type === 'done') {
      console.log('Complete!', event.metadata);
    }
  });

  // List agents
  const agents = await client.listAgents();
  console.log('Available agents:', agents);

  // Execute agent
  client.execute('customer-support', 'Hello! How can I track my order?', {
    userId: 'user-123',
    sessionData: {
      orderNumber: '12345',
    },
  });

  // Later, disconnect
  // client.disconnect();
}

// Export examples
export {
  basicWebSocketClient,
  WebSocketChatComponent,
  multiAgentWebSocket,
  authenticatedWebSocket,
  AgentWebSocketClient,
  useAgentClient,
};
