import { Writable } from "node:stream";
import type { ConfigService } from "@croco/framework-config";
import { Context } from "@croco/framework-context";
import { Problem, ProblemCategory } from "@croco/problems-core";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { Logger } from "../Logger";
import { MAX_LOG_NESTING_DEPTH } from "../sanitizeLogRecord";

type LogRecord = Record<string, unknown>;

class LoggedNotFoundProblem extends Problem {
  constructor() {
    super("RESOURCE_NOT_FOUND", ProblemCategory.NotFound, "Resource missing", {
      instance: "/resources/missing",
      type: "https://croco.dev/problems/resource-not-found",
      extensions: {
        operation: "resource.read",
        token: "problem-token",
      },
    });
  }
}

class ThrowingTitleProblem extends Problem {
  public titleReads = 0;

  constructor() {
    super("BROKEN_TITLE", ProblemCategory.InternalServerError, "Title unavailable");
  }

  override get title(): string {
    this.titleReads += 1;
    throw new Error("problem-title-secret");
  }
}

function createCapturedLogger(): { logger: Logger; raw: () => string; records: () => LogRecord[] } {
  const chunks: string[] = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk.toString("utf8"));
      callback();
    },
  });
  const config = {
    get: () => "info",
    isProduction: true,
  } as unknown as ConfigService;
  const logger = new Logger(config);

  Object.defineProperty(logger["logger"], pino.symbols.streamSym, { value: destination });

  return {
    logger,
    raw: () => chunks.join(""),
    records: () =>
      chunks
        .join("")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as LogRecord),
  };
}

describe("Logger serialized redaction", () => {
  it("removes credential key variants at every structured logging boundary", () => {
    const { logger, raw, records } = createCapturedLogger();
    const credentialKeys = [
      "password",
      "pass_word",
      "TOKEN",
      "secret",
      "authorization",
      "cookie",
      "accessToken",
      "ACCESS-TOKEN",
      "refresh_token",
      "ID-TOKEN",
      "apiKey",
      "API_KEY",
      "x-api-key",
      "X_API_KEY",
      "clientSecret",
      "private_key",
      "accessKey",
      "secret_access_key",
      "credential",
      "credentials",
      "set-cookie",
      "proxy-authorization",
      "databaseUrl",
      "redis_url",
      "connection-string",
      "dsn",
    ];
    const credentials = (location: string): Record<string, string> =>
      Object.fromEntries(
        credentialKeys.map((key, index) => [key, `${location}-credential-${index}-end`]),
      );

    logger.info("request received", {
      ...credentials("top"),
      nested: { ...credentials("nested"), tokenCount: 12 },
      entries: [{ ...credentials("array"), tokensUsed: 7 }],
    });

    logger
      .child({
        ...credentials("binding"),
        childContext: { ...credentials("child"), passwordPolicy: "strict" },
      })
      .info("child request", { operation: "charge" });

    const error = Object.assign(new Error("provider failed"), {
      ...credentials("error"),
      metadata: { ...credentials("error-nested"), tokenCount: 3 },
    });
    logger.error("provider request failed", error);

    const bytes = raw();
    for (const location of [
      "top",
      "nested",
      "array",
      "binding",
      "child",
      "error",
      "error-nested",
    ]) {
      for (const value of Object.values(credentials(location))) {
        expect(bytes).not.toContain(value);
      }
    }

    expect(records()[0]).toMatchObject({
      nested: { tokenCount: 12 },
      entries: [{ tokensUsed: 7 }],
    });
    expect(records()[1]).toMatchObject({
      childContext: { passwordPolicy: "strict" },
      operation: "charge",
    });
    expect(records()[2]).toMatchObject({
      err: { message: "provider failed", metadata: { tokenCount: 3 } },
    });
  });

  it("removes sensitive keys case-insensitively from nested objects and arrays", () => {
    const { logger, raw, records } = createCapturedLogger();

    Context.run({ requestId: "req-2057", traceId: "trace-2057" }, () => {
      logger.info("request received", {
        password: "root-password",
        request: {
          body: {
            PASSWORD: "nested-password",
            profile: { token: "nested-token", displayName: "Ada" },
          },
          headers: {
            Authorization: "nested-authorization",
            "x-request-id": "header-request-id",
          },
        },
        providers: [
          { SeCrEt: "array-secret", operation: "charge" },
          { Cookie: "array-cookie", status: 202 },
        ],
        callbackUrl: new URL("https://example.com/callback"),
        eventSequence: 9007199254740993n,
      });
    });

    const output = records();
    const bytes = raw();
    expect(bytes).not.toContain("root-password");
    expect(bytes).not.toContain("nested-password");
    expect(bytes).not.toContain("nested-token");
    expect(bytes).not.toContain("nested-authorization");
    expect(bytes).not.toContain("array-secret");
    expect(bytes).not.toContain("array-cookie");
    expect(bytes).toContain('"eventSequence":"9007199254740993"');
    expect(output[0]).toMatchObject({
      requestId: "req-2057",
      traceId: "trace-2057",
      request: {
        body: { profile: { displayName: "Ada" } },
        headers: { "x-request-id": "header-request-id" },
      },
      providers: [{ operation: "charge" }, { status: 202 }],
      callbackUrl: "https://example.com/callback",
      eventSequence: "9007199254740993",
    });
  });

  it("redacts nested child bindings without removing correlation fields", () => {
    const { logger, raw, records } = createCapturedLogger();
    const child = logger.child({
      requestId: "child-request-id",
      provider: { TOKEN: "child-token", accountId: "acct-2057" },
    });

    child.info("child event", { operation: "authorize" });

    const output = records();
    expect(raw()).not.toContain("child-token");
    expect(output[0]).toMatchObject({
      requestId: "child-request-id",
      provider: { accountId: "acct-2057" },
      operation: "authorize",
    });
  });

  it.each(["error", "fatal"] as const)(
    "prevents Error metadata from reintroducing sensitive values at %s severity",
    (severity) => {
      const { logger, raw, records } = createCapturedLogger();
      let getterCalls = 0;
      const error = Object.assign(new Error("provider failed"), {
        metadata: { secret: "error-secret", provider: "payments" },
        Authorization: "error-authorization",
      });
      Object.defineProperty(error, "cookie", {
        enumerable: true,
        get() {
          getterCalls += 1;
          return "error-cookie";
        },
      });

      logger[severity]("provider request failed", error);

      const output = records();
      const bytes = raw();
      expect(bytes).not.toContain("error-secret");
      expect(bytes).not.toContain("error-authorization");
      expect(bytes).not.toContain("error-cookie");
      expect(getterCalls).toBe(0);
      expect(output[0]).toMatchObject({
        err: {
          type: "Error",
          message: "provider failed",
          stack: expect.stringContaining("Error: provider failed"),
          metadata: { provider: "payments" },
        },
      });
    },
  );

  it("preserves sanitized Problem details and extensions", () => {
    const { logger, raw, records } = createCapturedLogger();

    logger.error("resource request failed", new LoggedNotFoundProblem());

    const output = records();
    const bytes = raw();
    expect(bytes).not.toContain("problem-token");
    expect(output[0]).toMatchObject({
      err: {
        type: "LoggedNotFoundProblem",
        message: "Resource missing",
        code: "RESOURCE_NOT_FOUND",
        detail: "Resource missing",
        instance: "/resources/missing",
        title: "Not Found",
        status: 404,
        operation: "resource.read",
      },
    });
  });

  it("falls back to Error diagnostics when Problem serialization throws", () => {
    const { logger, raw, records } = createCapturedLogger();
    const problem = new ThrowingTitleProblem();

    expect(() => logger.error("broken problem request failed", problem)).not.toThrow();

    expect(problem.titleReads).toBe(1);
    expect(raw()).not.toContain("problem-title-secret");
    expect(records()[0]).toMatchObject({
      err: {
        type: "ThrowingTitleProblem",
        message: "Title unavailable",
        code: "BROKEN_TITLE",
        detail: "Title unavailable",
      },
    });
  });

  it("does not invoke serialization methods on non-Problem errors", () => {
    const { logger, raw, records } = createCapturedLogger();
    let serializationCalls = 0;
    const error = Object.assign(new Error("custom error failure"), {
      toJSON: () => {
        serializationCalls += 1;
        return { status: 418, token: "custom-error-token" };
      },
    });

    logger.error("custom error request failed", error);

    expect(serializationCalls).toBe(0);
    expect(raw()).not.toContain("custom-error-token");
    expect(records()[0]).toMatchObject({
      err: {
        type: "Error",
        message: "custom error failure",
      },
    });
    expect(records()[0]?.err).not.toHaveProperty("status");
  });
  it.each(["error", "fatal"] as const)(
    "keeps Error-attached caller context at %s severity",
    (severity) => {
      const { logger, raw, records } = createCapturedLogger();
      const child = logger.child({ component: "billing" });
      const error = Object.assign(new Error("provider failed"), {
        password: "caller-password",
        userId: "user-2504",
      });

      Context.run({ requestId: "req-2504", traceId: "trace-2504" }, () => {
        child[severity]("provider request failed", error);
      });

      const output = records();
      expect(raw()).not.toContain("caller-password");
      expect(output[0]).toMatchObject({
        component: "billing",
        requestId: "req-2504",
        traceId: "trace-2504",
        userId: "user-2504",
        err: {
          message: "provider failed",
          userId: "user-2504",
        },
      });
    },
  );

  it("preserves cause and aggregate Error diagnostics", () => {
    const { logger, raw, records } = createCapturedLogger();
    const nestedError = Object.assign(new Error("nested failure"), { token: "nested-token" });
    const error = Object.assign(new Error("aggregate failure"), { errors: [nestedError] });
    Object.defineProperty(error, "cause", { value: new Error("provider cause") });

    logger.error("aggregate request failed", error);

    const output = records();
    expect(raw()).not.toContain("nested-token");
    expect(output[0]).toMatchObject({
      err: {
        message: "aggregate failure: provider cause",
        stack: expect.stringContaining("caused by: Error: provider cause"),
        aggregateErrors: [
          {
            message: "nested failure",
            stack: expect.stringContaining("Error: nested failure"),
          },
        ],
      },
    });
  });

  it("sanitizes circular and custom serialization values without an unredacted fallback", () => {
    const { logger, raw, records } = createCapturedLogger();
    const circular: Record<string, unknown> = {
      operation: "circular-check",
      token: "circular-token",
    };
    circular.self = circular;
    const customSerialization = {
      operation: "custom-check",
      toJSON: () => ({ password: "custom-password" }),
    };
    const accessor = Object.defineProperty({ operation: "accessor-check" }, "secret", {
      enumerable: true,
      get() {
        throw new Error("accessor-secret");
      },
    });
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();

    expect(() =>
      logger.info("unsafe context", {
        circular,
        customSerialization,
        accessor,
        proxy: revocable.proxy,
        status: 202,
      }),
    ).not.toThrow();

    const output = records();
    const bytes = raw();
    expect(bytes).not.toContain("circular-token");
    expect(bytes).not.toContain("custom-password");
    expect(bytes).not.toContain("accessor-secret");
    expect(output[0]).toMatchObject({
      circular: { operation: "circular-check", self: "[Circular]" },
      customSerialization: { operation: "custom-check" },
      accessor: { operation: "accessor-check" },
      proxy: "[Unserializable]",
      status: 202,
    });
  });

  it("does not execute top-level context getters before sanitization", () => {
    const { logger, raw, records } = createCapturedLogger();
    let getterCalls = 0;
    const context = Object.defineProperty({ operation: "getter-check" }, "provider", {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error("top-level-getter-secret");
      },
    });

    expect(() =>
      Context.run({ requestId: "getter-request-id" }, () => logger.info("getter context", context)),
    ).not.toThrow();

    const output = records();
    expect(getterCalls).toBe(0);
    expect(raw()).not.toContain("top-level-getter-secret");
    expect(output[0]).toMatchObject({ requestId: "getter-request-id", operation: "getter-check" });
  });

  it("keeps correlation context when an error context cannot be inspected", () => {
    const { logger, records } = createCapturedLogger();
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();

    expect(() =>
      Context.run({ requestId: "proxy-request-id" }, () =>
        logger.error("proxy context", revocable.proxy),
      ),
    ).not.toThrow();

    expect(records()[0]).toMatchObject({
      requestId: "proxy-request-id",
      context: "[Unserializable]",
    });
  });

  it("truncates branches beyond the supported nesting depth without leaking their values", () => {
    const { logger, raw, records } = createCapturedLogger();
    const deepContext: Record<string, unknown> = {};
    let cursor = deepContext;

    for (let depth = 1; depth < MAX_LOG_NESTING_DEPTH; depth += 1) {
      const next: Record<string, unknown> = { depth };
      cursor.next = next;
      cursor = next;
    }
    cursor.next = { operation: "too-deep", password: "deep-password" };

    logger.info("deep context", { deepContext });

    const output = records();
    const bytes = raw();
    expect(bytes).not.toContain("deep-password");
    expect(bytes).not.toContain("too-deep");
    expect(bytes).toContain("[Truncated]");
  });
});
