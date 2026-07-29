import { RateLimitKeyBuilderProblem } from "./problems/RateLimitConfigProblems";

export type KeyContext = {
  get<T>(key: string): T | undefined;
};

export type KeySegment = "tenant" | "user" | "ip" | "apiKey" | "route" | "custom";

type KeyFieldValue = string | null | Array<[string, string | null]>;

export class RateLimitKeyBuilder {
  private readonly segments: KeySegment[];

  constructor(segments: KeySegment[]) {
    if (segments.length === 0) {
      throw new RateLimitKeyBuilderProblem("At least one key segment is required");
    }
    this.segments = segments;
  }

  build(context: KeyContext, policyName: string): string {
    const fields: Array<[string, KeyFieldValue]> = [["policy", policyName]];
    for (const segment of this.segments) {
      fields.push([segment, this.extractSegment(context, segment) ?? null]);
    }

    return `rl2:${JSON.stringify(fields)}`;
  }

  private extractSegment(context: KeyContext, segment: KeySegment): KeyFieldValue | undefined {
    switch (segment) {
      case "tenant":
        return context.get<{ id: string }>("tenant")?.id ?? context.get<string>("tenantId");
      case "user":
        return context.get<{ id: string }>("user")?.id ?? context.get<string>("userId");
      case "ip":
        return context.get<string>("ip") ?? context.get<string>("clientIp");
      case "apiKey":
        return context.get<string>("apiKey");
      case "route":
        return this.buildRouteKey(context);
      case "custom":
        return context.get<string>("custom");
      default:
        return undefined;
    }
  }

  private buildRouteKey(context: KeyContext): Array<[string, string | null]> {
    const method = context.get<string>("method");
    const path = context.get<string>("path");

    return [
      ["method", method ?? null],
      ["path", path ?? null],
    ];
  }
}
