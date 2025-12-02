/**
 * Example NestJS application with formatting support
 * This demonstrates how to use formatting in a NestJS API
 */

import { Module, Controller, Post, Body, Get } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  AgenticModule,
  AgentDecorator,
  ExecuteAgentDto,
  AnthropicProvider,
  ToolRegistry,
  BufferMemory,
  Agent,
} from '@lov3kaizen/agentsea-nestjs';

/**
 * Custom agent with formatting support
 * Note: Prefixed with _ to indicate this is example code for documentation purposes
 */
@AgentDecorator({
  name: 'documentation-agent',
  description: 'Agent that generates documentation with rich formatting',
  model: 'claude-3-5-sonnet-20241022',
  provider: 'anthropic',
  outputFormat: 'markdown',
  formatOptions: {
    includeMetadata: true,
    highlightCode: true,
  },
})
class _DocumentationAgent {}

/**
 * Custom agent for code examples (HTML output)
 * Note: Prefixed with _ to indicate this is example code for documentation purposes
 */
@AgentDecorator({
  name: 'code-example-agent',
  description: 'Agent that generates code examples with syntax highlighting',
  model: 'claude-3-5-sonnet-20241022',
  provider: 'anthropic',
  outputFormat: 'html',
  formatOptions: {
    includeMetadata: true,
    sanitizeHtml: true,
    highlightCode: true,
    theme: 'dark',
  },
})
class _CodeExampleAgent {}

/**
 * Custom controller for formatted responses
 */
@Controller('formatted')
export class FormattedController {
  constructor(
    private readonly docAgent: Agent,
    private readonly codeAgent: Agent,
  ) {}

  /**
   * Generate documentation in markdown
   * POST /formatted/docs
   */
  @Post('docs')
  async generateDocs(@Body() dto: ExecuteAgentDto) {
    // Use markdown format (default from agent config)
    const response = await this.docAgent.execute(dto.input, {
      conversationId: dto.conversationId || `docs-${Date.now()}`,
      userId: dto.userId,
      sessionData: dto.sessionData || {},
      history: dto.history || [],
      metadata: dto.metadata,
    });

    return {
      success: true,
      data: {
        content: response.content,
        formatted: response.formatted,
        format: response.formatted?.format || 'text',
        metadata: response.metadata,
      },
    };
  }

  /**
   * Generate code example in HTML
   * POST /formatted/code
   */
  @Post('code')
  async generateCode(@Body() dto: ExecuteAgentDto) {
    // Use HTML format (default from agent config)
    const response = await this.codeAgent.execute(dto.input, {
      conversationId: dto.conversationId || `code-${Date.now()}`,
      userId: dto.userId,
      sessionData: dto.sessionData || {},
      history: dto.history || [],
      metadata: dto.metadata,
    });

    return {
      success: true,
      data: {
        content: response.content,
        formatted: response.formatted,
        format: response.formatted?.format || 'text',
        metadata: response.metadata,
      },
    };
  }

  /**
   * Execute with custom format specified at runtime
   * POST /formatted/custom
   */
  @Post('custom')
  async customFormat(@Body() dto: ExecuteAgentDto) {
    // Runtime format can override agent config
    const response = await this.docAgent.execute(dto.input, {
      conversationId: dto.conversationId || `custom-${Date.now()}`,
      userId: dto.userId,
      sessionData: dto.sessionData || {},
      history: dto.history || [],
      metadata: dto.metadata,
    });

    // Format the response with custom options if provided
    if (dto.outputFormat) {
      this.docAgent.config.outputFormat = dto.outputFormat;
      if (dto.formatOptions) {
        this.docAgent.config.formatOptions = dto.formatOptions;
      }
    }

    return {
      success: true,
      data: {
        content: response.content,
        formatted: response.formatted,
        format: response.formatted?.format || 'text',
        metadata: response.metadata,
      },
    };
  }

  /**
   * Get formatted content as HTML for rendering
   * POST /formatted/render
   */
  @Post('render')
  async renderHtml(@Body() dto: ExecuteAgentDto) {
    // Override to use HTML format
    this.docAgent.config.outputFormat = 'html';
    this.docAgent.config.formatOptions = {
      includeMetadata: true,
      sanitizeHtml: true,
      highlightCode: true,
      theme: dto.formatOptions?.theme || 'light',
    };

    const response = await this.docAgent.execute(dto.input, {
      conversationId: dto.conversationId || `render-${Date.now()}`,
      userId: dto.userId,
      sessionData: dto.sessionData || {},
      history: dto.history || [],
      metadata: dto.metadata,
    });

    // Return HTML that can be directly rendered
    return {
      success: true,
      html: response.formatted?.rendered || response.content,
      metadata: {
        hasCodeBlocks: response.formatted?.metadata?.hasCodeBlocks,
        hasTables: response.formatted?.metadata?.hasTables,
        hasLists: response.formatted?.metadata?.hasLists,
        linksCount: response.formatted?.metadata?.links?.length || 0,
      },
    };
  }

  /**
   * Health check
   * GET /formatted/health
   */
  @Get('health')
  health() {
    return {
      success: true,
      message: 'Formatted API is running',
      features: {
        markdown: true,
        html: true,
        react: true,
        streaming: true,
      },
    };
  }
}

/**
 * Main application module
 */
@Module({
  imports: [
    AgenticModule.forRoot({
      providers: {
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY || '',
        },
      },
      memory: {
        type: 'buffer',
        maxMessages: 50,
      },
      observability: {
        logging: {
          level: 'info',
        },
      },
    }),
  ],
  controllers: [FormattedController],
  providers: [
    {
      provide: Agent,
      useFactory: () => {
        const provider = new AnthropicProvider({
          apiKey: process.env.ANTHROPIC_API_KEY || '',
        });
        const toolRegistry = new ToolRegistry();
        const memory = new BufferMemory({ maxMessages: 50 });

        return new Agent(
          {
            name: 'documentation-agent',
            description: 'Documentation agent',
            model: 'claude-3-5-sonnet-20241022',
            provider: 'anthropic',
            outputFormat: 'markdown',
            formatOptions: {
              includeMetadata: true,
            },
          },
          provider,
          toolRegistry,
          memory,
        );
      },
    },
  ],
})
class AppModule {}

/**
 * Bootstrap the application
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend access
  app.enableCors();

  // Set global prefix
  app.setGlobalPrefix('api');

  await app.listen(3000);

  console.log('🚀 NestJS Formatting API running on http://localhost:3000');
  console.log('\nAvailable endpoints:');
  console.log(
    '  POST /api/formatted/docs    - Generate markdown documentation',
  );
  console.log('  POST /api/formatted/code    - Generate HTML code examples');
  console.log('  POST /api/formatted/custom  - Custom format at runtime');
  console.log('  POST /api/formatted/render  - Render HTML for display');
  console.log('  GET  /api/formatted/health  - Health check');
  console.log('\nExample request:');
  console.log(`
curl -X POST http://localhost:3000/api/formatted/docs \\
  -H "Content-Type: application/json" \\
  -d '{
    "input": "Create a table comparing REST and GraphQL APIs",
    "outputFormat": "markdown",
    "formatOptions": {
      "includeMetadata": true
    }
  }'
  `);
}

// Start the application if this file is run directly
if (require.main === module) {
  bootstrap().catch((error) => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}

export { AppModule, FormattedController, bootstrap };
