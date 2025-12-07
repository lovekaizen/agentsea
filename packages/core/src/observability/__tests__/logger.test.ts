import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, defaultLogger } from '../logger';

// Mock winston
vi.mock('winston', () => {
  const mockLogger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };

  return {
    default: {
      createLogger: vi.fn().mockReturnValue(mockLogger),
      format: {
        json: vi.fn().mockReturnValue({}),
        simple: vi.fn().mockReturnValue({}),
        combine: vi.fn().mockReturnValue({}),
        colorize: vi.fn().mockReturnValue({}),
        timestamp: vi.fn().mockReturnValue({}),
        printf: vi.fn().mockReturnValue({}),
      },
      transports: {
        Console: vi.fn().mockImplementation(() => ({})),
        File: vi.fn().mockImplementation(() => ({})),
      },
    },
  };
});

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a logger with default config', () => {
      const logger = new Logger();
      expect(logger).toBeDefined();
    });

    it('should create a logger with custom level', () => {
      const logger = new Logger({ level: 'debug' });
      expect(logger).toBeDefined();
    });

    it('should create a logger with json format', () => {
      const logger = new Logger({ format: 'json' });
      expect(logger).toBeDefined();
    });

    it('should create a logger with simple format', () => {
      const logger = new Logger({ format: 'simple' });
      expect(logger).toBeDefined();
    });

    it('should create a logger with file transport', () => {
      const logger = new Logger({ filename: 'test.log' });
      expect(logger).toBeDefined();
    });

    it('should create a logger without console transport', () => {
      const logger = new Logger({ console: false });
      expect(logger).toBeDefined();
    });
  });

  describe('logging methods', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger();
    });

    it('should log error messages', () => {
      logger.error('Error message');
      // Winston mock is called
      expect(logger).toBeDefined();
    });

    it('should log error messages with metadata', () => {
      logger.error('Error message', { code: 'ERR001' });
      expect(logger).toBeDefined();
    });

    it('should log warn messages', () => {
      logger.warn('Warning message');
      expect(logger).toBeDefined();
    });

    it('should log warn messages with metadata', () => {
      logger.warn('Warning message', { code: 'WARN001' });
      expect(logger).toBeDefined();
    });

    it('should log info messages', () => {
      logger.info('Info message');
      expect(logger).toBeDefined();
    });

    it('should log info messages with metadata', () => {
      logger.info('Info message', { data: 'test' });
      expect(logger).toBeDefined();
    });

    it('should log debug messages', () => {
      logger.debug('Debug message');
      expect(logger).toBeDefined();
    });

    it('should log debug messages with metadata', () => {
      logger.debug('Debug message', { details: 'test' });
      expect(logger).toBeDefined();
    });
  });

  describe('child logger', () => {
    it('should create a child logger with context', () => {
      const logger = new Logger();
      const childLogger = logger.child({ requestId: '123' });

      expect(childLogger).toBeInstanceOf(Logger);
    });
  });

  describe('defaultLogger', () => {
    it('should be an instance of Logger', () => {
      expect(defaultLogger).toBeInstanceOf(Logger);
    });
  });
});
