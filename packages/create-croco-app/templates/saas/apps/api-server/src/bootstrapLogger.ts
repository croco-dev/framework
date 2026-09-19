import type { ILogger } from "@croco/framework-context";

export class BootstrapLogger implements ILogger {
  constructor(private readonly bindings: Record<string, unknown> = {}) {}

  debug(message: string, context?: Record<string, unknown>): void {
    const outputContext = this.withBindings(context);
    if (outputContext === undefined) {
      console.debug(message);
      return;
    }
    console.debug(message, outputContext);
  }

  info(message: string, context?: Record<string, unknown>): void {
    const outputContext = this.withBindings(context);
    if (outputContext === undefined) {
      console.info(message);
      return;
    }
    console.info(message, outputContext);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    const outputContext = this.withBindings(context);
    if (outputContext === undefined) {
      console.warn(message);
      return;
    }
    console.warn(message, outputContext);
  }

  error(message: string, context?: Record<string, unknown> | Error): void {
    this.writeError(message, context);
  }

  fatal(message: string, context?: Record<string, unknown> | Error): void {
    this.writeError(message, context);
  }

  child(bindings: Record<string, unknown>): ILogger {
    return new BootstrapLogger({ ...this.bindings, ...bindings });
  }

  private writeError(message: string, context?: Record<string, unknown> | Error): void {
    if (context instanceof Error) {
      if (Object.keys(this.bindings).length === 0) {
        console.error(message, context);
        return;
      }
      console.error(message, this.bindings, context);
      return;
    }

    const outputContext = this.withBindings(context);
    if (outputContext === undefined) {
      console.error(message);
      return;
    }
    console.error(message, outputContext);
  }

  private withBindings(context?: Record<string, unknown>): Record<string, unknown> | undefined {
    const outputContext = { ...this.bindings, ...context };
    return Object.keys(outputContext).length === 0 ? undefined : outputContext;
  }
}
