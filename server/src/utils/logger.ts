import { sanitizeLogValue } from './sanitizer.js';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVEL_PRIORITIES: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

class StructuredLogger {
  private level: LogLevel = 'info';

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITIES[level] <= LOG_LEVEL_PRIORITIES[this.level];
  }

  private emit(level: LogLevel, message: string, context?: Record<string, unknown>) {
    if (!this.shouldLog(level)) return;

    // Cloud Run / Google Cloud Logging severity mapping
    const severityMap: Record<LogLevel, string> = {
      debug: 'DEBUG',
      info: 'INFO',
      warn: 'WARNING',
      error: 'ERROR'
    };

    const sanitizedContext = context ? (sanitizeLogValue(context) as Record<string, unknown>) : undefined;

    const payload = {
      severity: severityMap[level],
      message: typeof message === 'string' ? sanitizeLogValue(message) : message,
      timestamp: new Date().toISOString(),
      ...sanitizedContext
    };

    const serialized = JSON.stringify(payload);
    if (level === 'error') {
      process.stderr.write(`${serialized}\n`);
    } else {
      process.stdout.write(`${serialized}\n`);
    }
  }

  info(message: string, context?: Record<string, unknown>) {
    this.emit('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.emit('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.emit('error', message, context);
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.emit('debug', message, context);
  }
}

export const logger = new StructuredLogger();
