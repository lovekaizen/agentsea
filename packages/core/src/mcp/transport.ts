import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

import { MCPMessage } from './types';

/**
 * Base transport interface for MCP communication
 */
export interface MCPTransport extends EventEmitter {
  connect(): Promise<void>;
  send(message: MCPMessage): void;
  close(): void;
  isConnected(): boolean;
}

/**
 * STDIO transport for MCP servers
 */
export class StdioTransport extends EventEmitter implements MCPTransport {
  private process: ChildProcess | null = null;
  private connected = false;
  private buffer = '';

  constructor(
    private command: string,
    private args: string[] = [],
    private env?: Record<string, string>,
  ) {
    super();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.command, this.args, {
          env: { ...process.env, ...this.env },
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        this.process.stdout?.on('data', (data: Buffer) => {
          this.handleData(data.toString());
        });

        this.process.stderr?.on('data', (data: Buffer) => {
          this.emit('error', new Error(data.toString()));
        });

        this.process.on('error', (error) => {
          this.connected = false;
          this.emit('error', error);
          reject(error);
        });

        this.process.on('exit', (code) => {
          this.connected = false;
          this.emit('disconnect', code);
        });

        this.connected = true;
        this.emit('connect');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  send(message: MCPMessage): void {
    if (!this.connected || !this.process?.stdin) {
      throw new Error('Transport not connected');
    }

    const json = JSON.stringify(message) + '\n';
    this.process.stdin.write(json);
  }

  close(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  private handleData(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line) as MCPMessage;
          this.emit('message', message);
        } catch (error) {
          this.emit('error', new Error(`Failed to parse message: ${line}`));
        }
      }
    }
  }
}

/**
 * SSE (Server-Sent Events) transport for MCP servers
 */
export class SSETransport extends EventEmitter implements MCPTransport {
  private eventSource: EventSource | null = null;
  private connected = false;

  constructor(private url: string) {
    super();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Note: EventSource is not available in Node.js by default
        // You would need to use a polyfill like 'eventsource' package
        if (typeof EventSource === 'undefined') {
          throw new Error(
            'EventSource not available. Install eventsource package for Node.js support.',
          );
        }

        this.eventSource = new EventSource(this.url);

        this.eventSource.onopen = () => {
          this.connected = true;
          this.emit('connect');
          resolve();
        };

        this.eventSource.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as MCPMessage;
            this.emit('message', message);
          } catch (error) {
            this.emit('error', new Error('Failed to parse SSE message'));
          }
        };

        this.eventSource.onerror = (error) => {
          this.connected = false;
          this.emit('error', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  async send(message: MCPMessage): Promise<void> {
    if (!this.connected) {
      throw new Error('Transport not connected');
    }

    // For SSE, we typically need to make HTTP POST requests
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  close(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
