import winston from 'winston';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LoggerConfig {
  level?: LogLevel;
  format?: 'json' | 'simple';
  filename?: string;
  console?: boolean;
}

/**
 * Logger for AgentSea
 */
export class Logger {
  private logger: winston.Logger;

  constructor(config: LoggerConfig = {}) {
    const format =
      config.format === 'json'
        ? winston.format.json()
        : winston.format.simple();

    const transports: winston.transport[] = [];

    // Console transport
    if (config.console !== false) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length
                ? JSON.stringify(meta)
                : '';
              return `${String(timestamp)} [${String(level)}]: ${String(message)} ${metaStr}`;
            }),
          ),
        }),
      );
    }

    // File transport
    if (config.filename) {
      transports.push(
        new winston.transports.File({
          filename: config.filename,
          format,
        }),
      );
    }

    this.logger = winston.createLogger({
      level: config.level || 'info',
      transports,
    });
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, any>): Logger {
    const childLogger = new Logger();
    childLogger.logger = this.logger.child(context);
    return childLogger;
  }
}

// Default logger instance
export const defaultLogger = new Logger({
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  console: true,
});
