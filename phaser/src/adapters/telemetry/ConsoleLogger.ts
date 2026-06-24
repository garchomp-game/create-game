import type { LogFields, LoggerPort, LogLevel } from "../../ports/LoggerPort";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class ConsoleLogger implements LoggerPort {
  constructor(private readonly minLevel: LogLevel = "warn") {}

  debug(event: string, fields?: LogFields): void {
    this.write("debug", event, fields);
  }

  info(event: string, fields?: LogFields): void {
    this.write("info", event, fields);
  }

  warn(event: string, fields?: LogFields): void {
    this.write("warn", event, fields);
  }

  error(event: string, fields?: LogFields): void {
    this.write("error", event, fields);
  }

  private write(level: LogLevel, event: string, fields?: LogFields): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) return;

    const payload = fields ? { event, ...fields } : { event };
    if (level === "error") {
      console.error(payload);
    } else if (level === "warn") {
      console.warn(payload);
    } else if (level === "info") {
      console.info(payload);
    } else {
      console.debug(payload);
    }
  }
}
