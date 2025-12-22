/**
 * Surf NestJS Integration Example
 *
 * This example shows how to integrate the Surf module
 * with a NestJS application.
 */

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Import from the nestjs subpath
import { SurfModule, SurfService } from '@lov3kaizen/agentsea-surf/nestjs';

/**
 * Application module with Surf integration
 */
@Module({
  imports: [
    // Load environment configuration
    ConfigModule.forRoot(),

    // Option 1: Synchronous configuration
    // SurfModule.forRoot({
    //   backend: { type: 'native' },
    //   config: {
    //     maxSteps: 50,
    //     sandbox: { enabled: true },
    //   },
    //   enableRestApi: true,
    //   enableWebSocket: true,
    // }),

    // Option 2: Async configuration (recommended for production)
    SurfModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        backend: {
          type: (configService.get('SURF_BACKEND') || 'native') as
            | 'native'
            | 'browser'
            | 'docker',
          options: {},
        },
        config: {
          maxSteps: configService.get('SURF_MAX_STEPS', 50),
          screenshotDelay: configService.get('SURF_SCREENSHOT_DELAY', 500),
          sandbox: {
            enabled: configService.get('SURF_SANDBOX_ENABLED', true),
            maxActionsPerMinute: configService.get('SURF_RATE_LIMIT', 60),
          },
          vision: {
            model: configService.get(
              'SURF_VISION_MODEL',
              'claude-sonnet-4-20250514',
            ),
            maxTokens: 4096,
            includeScreenshotInResponse: true,
          },
        },
        enableRestApi: true,
        enableWebSocket: true,
      }),
      inject: [ConfigService],
    }),
  ],
})
class AppModule {}

async function bootstrap() {
  console.log('Surf NestJS Example\n');

  const app = await NestFactory.create(AppModule);

  // Enable CORS for development
  app.enableCors();

  // Get the service to demonstrate programmatic access
  const surfService = app.get(SurfService);

  console.log('Service status:');
  console.log(`  Backend: ${surfService.getBackendName()}`);
  console.log(`  Connected: ${surfService.isBackendConnected()}`);
  console.log('');

  await app.listen(3000);

  console.log('Server running on http://localhost:3000\n');
  console.log('Available endpoints:');
  console.log('  POST /surf/execute      - Execute a task');
  console.log('  POST /surf/action       - Execute single action');
  console.log('  POST /surf/screenshot   - Take a screenshot');
  console.log('  GET  /surf/screen       - Get screen state');
  console.log('  GET  /surf/sessions     - List active sessions');
  console.log('  GET  /surf/status       - Get backend status');
  console.log('');
  console.log('WebSocket available at ws://localhost:3000/surf');
  console.log('');
  console.log('Example curl commands:');
  console.log('');
  console.log('  # Take a screenshot');
  console.log('  curl -X POST http://localhost:3000/surf/screenshot');
  console.log('');
  console.log('  # Execute a task');
  console.log('  curl -X POST http://localhost:3000/surf/execute \\');
  console.log('       -H "Content-Type: application/json" \\');
  console.log('       -d \'{"task": "Describe what is on the screen"}\'');
  console.log('');
  console.log('  # Click at coordinates');
  console.log('  curl -X POST http://localhost:3000/surf/action \\');
  console.log('       -H "Content-Type: application/json" \\');
  console.log(
    '       -d \'{"action": "click", "params": {"x": 100, "y": 200}}\'',
  );
}

bootstrap().catch(console.error);
