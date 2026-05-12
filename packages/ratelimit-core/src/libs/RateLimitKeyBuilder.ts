import { RateLimitKeyBuilderProblem } from "./problems/RateLimitConfigProblems";

export type KeyContext = {
  get<T>(key: string): T | undefined;
};

export type KeySegment = "tenant" | "user" | "ip" | "apiKey" | "route" | "custom";

export class RateLimitKeyBuilder {
  private readonly segments: KeySegment[];

  constructor(segments: KeySegment[]) {
    if (segments.length === 0) {
      throw new RateLimitKeyBuilderProblem("At least one key segment is required");
    }
    this.segments = segments;
  }

  build(context: KeyContext, policyName: string): string {
    const parts: string[] = ["rl", policyName];

    for (const segment of this.segments) {
      const value = this.extractSegment(context, segment);
      parts.push(value ?? "");
    }

    return parts.join(":");
  }

  private extractSegment(context: KeyContext, segment: KeySegment): string | undefined {
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
        return undefined;
      default:
        return undefined;
    }
  }

  private buildRouteKey(context: KeyContext): string | undefined {
    const method = context.get<string>("method");
    const path = context.get<string>("path");

    if (method && path) {
      return `${method}:${path}`;
    }
    return undefined;
  }
}
