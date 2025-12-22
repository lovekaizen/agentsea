/**
 * NestJS Sandbox Guard
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';

import { SurfConfig } from '../../types';
import { SecurityValidator } from '../../utils/security-validator';

/**
 * Guard that enforces sandbox security rules on requests
 */
@Injectable()
export class SandboxGuard implements CanActivate {
  private validator: SecurityValidator;

  constructor(@Inject('COMPUTER_USE_CONFIG') config: SurfConfig) {
    this.validator = new SecurityValidator(config.sandbox);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const body = request.body || {};

    // Validate action if present
    if (body.action && body.params) {
      const result = this.validator.validateAction(body.action, body.params);
      if (!result.allowed) {
        throw new HttpException(
          {
            success: false,
            error: `Action blocked by sandbox: ${result.reason}`,
          },
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // Validate task text for dangerous patterns
    if (body.task) {
      const textResult = this.validator.validateAction('type', {
        text: body.task,
      });
      if (!textResult.allowed) {
        throw new HttpException(
          {
            success: false,
            error: `Task blocked by sandbox: ${textResult.reason}`,
          },
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // Validate URL if present
    if (body.url) {
      const urlResult = this.validator.validateUrl(body.url);
      if (!urlResult.allowed) {
        throw new HttpException(
          {
            success: false,
            error: `URL blocked by sandbox: ${urlResult.reason}`,
          },
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // Validate path if present
    if (body.path) {
      const pathResult = this.validator.validatePath(body.path);
      if (!pathResult.allowed) {
        throw new HttpException(
          {
            success: false,
            error: `Path blocked by sandbox: ${pathResult.reason}`,
          },
          HttpStatus.FORBIDDEN,
        );
      }
    }

    return true;
  }
}
