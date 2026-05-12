import { DomainEvent } from "@croco/events-core";
import type { LlmUsage } from "../types";

export class LlmUsageRecordedEvent extends DomainEvent {
  readonly type = "llm.usage_recorded";
  static eventName = "llm.usage_recorded";

  constructor(
    public readonly modelId: string,
    public readonly usage: LlmUsage,
    public readonly operation:
      | "generate"
      | "stream"
      | "embed"
      | "embedMany"
      | "generateObject"
      | "callTool",
  ) {
    super();
  }
}
