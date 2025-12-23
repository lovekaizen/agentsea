import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MCPClient } from '../client';
import { MCPServerConfig } from '../types';

// Mock transport
vi.mock('../transport', () => ({
  StdioTransport: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    send: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
  })),
  SSETransport: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    send: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
  })),
}));

describe('MCPClient', () => {
  let client: MCPClient;
  let mockTransport: any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (client) {
      // Cleanup
    }
  });

  describe('constructor', () => {
    it('should create client with stdio config', () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
      };

      client = new MCPClient(config);
      expect(client).toBeDefined();
    });

    it('should create client with SSE config', () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: 'sse',
        url: 'http://localhost:3000',
      };

      client = new MCPClient(config);
      expect(client).toBeDefined();
    });
  });

  describe('connect', () => {
    it('should connect and initialize', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
      };

      client = new MCPClient(config);

      // Mock transport
      mockTransport = (client as any).transport;
      const handleMessageSpy = vi.spyOn(client as any, 'handleMessage');

      // Mock sendRequest to return initialization response
      const sendRequestSpy = vi
        .spyOn(client as any, 'sendRequest')
        .mockResolvedValue({
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: {
              name: 'test-server',
              version: '1.0.0',
            },
            capabilities: {},
          },
        });

      // Mock transport methods
      const connectMock = vi.fn().mockResolvedValue(undefined);
      const onMock = vi.fn();

      (client as any).transport = {
        connect: connectMock,
        on: onMock,
      };

      await client.connect();

      expect(connectMock).toHaveBeenCalled();
      expect(onMock).toHaveBeenCalledWith('message', expect.any(Function));
      expect(onMock).toHaveBeenCalledWith('error', expect.any(Function));
      expect(onMock).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(sendRequestSpy).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: expect.any(Number),
        method: 'initialize',
        params: expect.objectContaining({
          protocolVersion: '2024-11-05',
        }),
      });
    });

    it('should create SSE transport when configured', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: 'sse',
        url: 'http://localhost:3000',
      };

      client = new MCPClient(config);

      const sendRequestSpy = vi
        .spyOn(client as any, 'sendRequest')
        .mockResolvedValue({
          result: {
            serverInfo: { name: 'test-server', version: '1.0.0' },
          },
        });

      const connectMock = vi.fn().mockResolvedValue(undefined);
      const onMock = vi.fn();

      (client as any).transport = {
        connect: connectMock,
        on: onMock,
      };

      await client.connect();

      expect(connectMock).toHaveBeenCalled();
    });

    it('should emit initialized event', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
      };

      client = new MCPClient(config);

      const sendRequestSpy = vi
        .spyOn(client as any, 'sendRequest')
        .mockResolvedValue({
          result: {
            serverInfo: { name: 'test-server', version: '1.0.0' },
            capabilities: {},
          },
        });

      const connectMock = vi.fn().mockResolvedValue(undefined);
      const onMock = vi.fn();

      (client as any).transport = {
        connect: connectMock,
        on: onMock,
      };

      const emitSpy = vi.spyOn(client, 'emit');

      await client.connect();

      expect(emitSpy).toHaveBeenCalledWith(
        'initialized',
        expect.objectContaining({
          serverInfo: { name: 'test-server', version: '1.0.0' },
        }),
      );
    });
  });

  describe('listTools', () => {
    it('should list available tools', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
      };

      client = new MCPClient(config);

      const sendRequestSpy = vi
        .spyOn(client as any, 'sendRequest')
        .mockResolvedValue({
          result: {
            tools: [
              {
                name: 'calculator',
                description: 'Perform calculations',
                inputSchema: {
                  type: 'object',
                  properties: {
                    expression: { type: 'string' },
                  },
                },
              },
            ],
          },
        });

      const tools = await client.listTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('calculator');
      expect(sendRequestSpy).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: expect.any(Number),
        method: 'tools/list',
        params: {},
      });
    });

    it('should return empty array when no tools available', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
      };

      client = new MCPClient(config);

      vi.spyOn(client as any, 'sendRequest').mockResolvedValue({
        result: {
          tools: [],
        },
      });

      const tools = await client.listTools();
      expect(tools).toEqual([]);
    });
  });

  describe('callTool', () => {
    it('should call tool with parameters', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
      };

      client = new MCPClient(config);

      const sendRequestSpy = vi
        .spyOn(client as any, 'sendRequest')
        .mockResolvedValue({
          result: {
            content: [
              {
                type: 'text',
                text: '4',
              },
            ],
            isError: false,
          },
        });

      const response = await client.callTool('calculator', {
        expression: '2 + 2',
      });

      expect(response.content[0].text).toBe('4');
      expect(response.isError).toBe(false);
      expect(sendRequestSpy).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: expect.any(Number),
        method: 'tools/call',
        params: {
          name: 'calculator',
          arguments: {
            expression: '2 + 2',
          },
        },
      });
    });

    it('should handle tool errors', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
      };

      client = new MCPClient(config);

      vi.spyOn(client as any, 'sendRequest').mockResolvedValue({
        result: {
          content: [
            {
              type: 'text',
              text: 'Invalid expression',
            },
          ],
          isError: true,
        },
      });

      const response = await client.callTool('calculator', {
        expression: 'invalid',
      });

      expect(response.isError).toBe(true);
    });

    it('should call tool without parameters', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
      };

      client = new MCPClient(config);

      const sendRequestSpy = vi
        .spyOn(client as any, 'sendRequest')
        .mockResolvedValue({
          result: {
            content: [{ type: 'text', text: 'Result' }],
            isError: false,
          },
        });

      await client.callTool('no-params-tool');

      expect(sendRequestSpy).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: expect.any(Number),
        method: 'tools/call',
        params: {
          name: 'no-params-tool',
          arguments: undefined,
        },
      });
    });
  });

  describe('listResources', () => {
    it('should list available resources', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
      };

      client = new MCPClient(config);

      const sendRequestSpy = vi
        .spyOn(client as any, 'sendRequest')
        .mockResolvedValue({
          result: {
            resources: [
              {
                uri: 'file:///path/to/file.txt',
                name: 'file.txt',
                description: 'A text file',
                mimeType: 'text/plain',
              },
            ],
          },
        });

      const resources = await client.listResources();

      expect(resources).toHaveLength(1);
      expect(resources[0].uri).toBe('file:///path/to/file.txt');
      expect(sendRequestSpy).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: expect.any(Number),
        method: 'resources/list',
        params: {},
      });
    });
  });

  describe('readResource', () => {
    it('should read resource content', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
      };

      client = new MCPClient(config);

      const sendRequestSpy = vi
        .spyOn(client as any, 'sendRequest')
        .mockResolvedValue({
          result: {
            contents: [
              {
                uri: 'file:///path/to/file.txt',
                mimeType: 'text/plain',
                text: 'File content',
              },
            ],
          },
        });

      const content = await client.readResource('file:///path/to/file.txt');

      expect(content.contents[0].text).toBe('File content');
      expect(sendRequestSpy).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: expect.any(Number),
        method: 'resources/read',
        params: {
          uri: 'file:///path/to/file.txt',
        },
      });
    });
  });

  describe('listPrompts', () => {
    it('should list available prompts', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
      };

      client = new MCPClient(config);

      const sendRequestSpy = vi
        .spyOn(client as any, 'sendRequest')
        .mockResolvedValue({
          result: {
            prompts: [
              {
                name: 'greeting',
                description: 'Generate a greeting',
                arguments: [],
              },
            ],
          },
        });

      const prompts = await client.listPrompts();

      expect(prompts).toHaveLength(1);
      expect(prompts[0].name).toBe('greeting');
      expect(sendRequestSpy).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: expect.any(Number),
        method: 'prompts/list',
        params: {},
      });
    });
  });

  describe('disconnect', () => {
    it('should disconnect from server', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
      };

      client = new MCPClient(config);

      const disconnectMock = vi.fn();
      (client as any).transport = {
        disconnect: disconnectMock,
      };

      await client.disconnect();

      expect(disconnectMock).toHaveBeenCalled();
    });

    it('should handle disconnect when no transport', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
      };

      client = new MCPClient(config);
      (client as any).transport = null;

      await expect(client.disconnect()).resolves.not.toThrow();
    });
  });

  describe('event handling', () => {
    it('should handle transport errors', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
      };

      client = new MCPClient(config);

      const errorHandler = vi.fn();
      client.on('error', errorHandler);

      const connectMock = vi.fn().mockResolvedValue(undefined);
      let errorCallback: ((error: Error) => void) | undefined;
      const onMock = vi.fn().mockImplementation((event: string, cb: any) => {
        if (event === 'error') {
          errorCallback = cb;
        }
      });

      (client as any).transport = {
        connect: connectMock,
        on: onMock,
      };

      vi.spyOn(client as any, 'sendRequest').mockResolvedValue({
        result: { serverInfo: { name: 'test', version: '1.0.0' } },
      });

      await client.connect();

      const testError = new Error('Transport error');
      errorCallback?.(testError);

      expect(errorHandler).toHaveBeenCalledWith(testError);
    });

    it('should handle disconnect event', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
      };

      client = new MCPClient(config);

      const disconnectHandler = vi.fn();
      client.on('disconnect', disconnectHandler);

      const connectMock = vi.fn().mockResolvedValue(undefined);
      let disconnectCallback: (() => void) | undefined;
      const onMock = vi.fn().mockImplementation((event: string, cb: any) => {
        if (event === 'disconnect') {
          disconnectCallback = cb;
        }
      });

      (client as any).transport = {
        connect: connectMock,
        on: onMock,
      };

      vi.spyOn(client as any, 'sendRequest').mockResolvedValue({
        result: { serverInfo: { name: 'test', version: '1.0.0' } },
      });

      await client.connect();

      disconnectCallback?.();

      expect(disconnectHandler).toHaveBeenCalled();
    });
  });
});
