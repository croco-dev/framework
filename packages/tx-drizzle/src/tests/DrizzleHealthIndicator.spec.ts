import { describe, expect, it, vi } from "vitest";
import { ProblemFactory } from "@croco/problems-core";
import { DrizzleHealthIndicator } from "../libs/DrizzleHealthIndicator";

describe("DrizzleHealthIndicator", () => {
  it("should return up when transaction query succeeds", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const db = {
      transaction: vi.fn(async (callback: (tx: { execute: typeof execute }) => Promise<void>) => {
        await callback({ execute });
      }),
    };

    const indicator = new DrizzleHealthIndicator(db as never, { name: "primary-db" });

    await expect(indicator.check()).resolves.toEqual({
      name: "primary-db",
      status: "up",
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("should return down with error details when transaction fails", async () => {
    const db = {
      transaction: vi
        .fn()
        .mockRejectedValue(
          ProblemFactory.internalServerError("testing/drizzle-transaction-failed", "database down"),
        ),
    };

    const indicator = new DrizzleHealthIndicator(db as never);

    await expect(indicator.check()).resolves.toEqual({
      name: "database",
      status: "down",
      details: { error: "database down" },
    });
  });

  it("should redact connection credentials from failure details", async () => {
    const db = {
      transaction: vi
        .fn()
        .mockRejectedValue(
          ProblemFactory.internalServerError(
            "testing/drizzle-health-indicator-redaction",
            "failed postgres://croco_user:super-secret@db.example/app?password=query-secret&sslmode=require token=raw-token",
          ),
        ),
    };

    const indicator = new DrizzleHealthIndicator(db as never);
    const result = await indicator.check();
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("super-secret");
    expect(serialized).not.toContain("query-secret");
    expect(serialized).not.toContain("raw-token");
    expect(result).toEqual({
      name: "database",
      status: "down",
      details: {
        error:
          "failed postgres://[redacted]@db.example/app?password=[redacted]&sslmode=require token=[redacted]",
      },
    });
  });

  it("should redact username-only connection userinfo from failure details", async () => {
    const db = {
      transaction: vi
        .fn()
        .mockRejectedValue(
          ProblemFactory.internalServerError(
            "testing/drizzle-health-indicator-redaction",
            "failed postgres://croco_user@db.example/app?password=query-secret&sslmode=require",
          ),
        ),
    };

    const indicator = new DrizzleHealthIndicator(db as never);
    const result = await indicator.check();
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("croco_user");
    expect(serialized).not.toContain("query-secret");
    expect(result).toEqual({
      name: "database",
      status: "down",
      details: {
        error: "failed postgres://[redacted]@db.example/app?password=[redacted]&sslmode=require",
      },
    });
  });

  it.each([
    [
      "password-only URL userinfo",
      "failed postgres://:uri-value@db.example/app?sslpassword=query-value&sslmode=require",
      "failed postgres://[redacted]@db.example/app?sslpassword=[redacted]&sslmode=require",
    ],
    [
      "prefixed credential keys",
      "failed host=db.example dbname=app sslmode=require sslpassword=key-value POSTGRES_PASSWORD=env-value",
      "failed host=db.example dbname=app sslmode=require sslpassword=[redacted] POSTGRES_PASSWORD=[redacted]",
    ],
    [
      "quoted credential values",
      "failed sslpassword = 'two\\' words' host=db.example",
      "failed sslpassword = [redacted] host=db.example",
    ],
    [
      "a quoted connection string containing a query",
      "failed DATABASE_DSN='postgres://db.example/app?token=query-value' dbname=app",
      "failed DATABASE_DSN=[redacted] dbname=app",
    ],
    [
      "punctuation in URL userinfo",
      "failed postgres://user:sample?part#tail@db.example/app?sslmode=require",
      "failed postgres://[redacted]@db.example/app?sslmode=require",
    ],
    [
      "at-signs in a password-only URL",
      "failed postgres://:sample@part@db.example/app?sslmode=require",
      "failed postgres://[redacted]@db.example/app?sslmode=require",
    ],
    [
      "punctuation and escaped whitespace in unquoted credentials",
      "failed sslpassword=sample,part;tail&last POSTGRES_PASSWORD=two\\ words host=db.example",
      "failed sslpassword=[redacted] POSTGRES_PASSWORD=[redacted] host=db.example",
    ],
    [
      "a double-quoted credential followed by a value suffix",
      'failed password="sample"tail sslmode=require',
      "failed password=[redacted] sslmode=require",
    ],
    [
      "credential-like text in a URL database name",
      "failed postgres://user@db.example/apptoken=reporting?sslmode=require",
      "failed postgres://[redacted]@db.example/apptoken=reporting?sslmode=require",
    ],
    [
      "credential-like text in a keyword database name",
      "failed host=db.example dbname='app apptoken=reporting' sslmode=require",
      "failed host=db.example dbname='app apptoken=reporting' sslmode=require",
    ],
    [
      "a bare credential inside a diagnostic field",
      "failed reason=password=sample dbname=app",
      "failed reason=password=[redacted] dbname=app",
    ],
    [
      "a connection URI nested in a query field",
      "failed postgres://db.example/app?application_name=postgres://user:sample@other.example/test&sslmode=require",
      "failed postgres://db.example/app?application_name=postgres://[redacted]@other.example/test&sslmode=require",
    ],
    [
      "credentials adjacent to a wrapped connection URI",
      "failed (postgres://user:sample@db.example/app);password=basic-value,sslpassword=prefixed-value",
      "failed (postgres://[redacted]@db.example/app);password=[redacted],sslpassword=[redacted]",
    ],
    [
      "connection fields following punctuation-delimited credentials",
      "failed password=sample;host=db.example;dbname=app;token=other,sslmode=require",
      "failed password=[redacted];host=db.example;dbname=app;token=[redacted],sslmode=require",
    ],
    [
      "a multiline keyword assignment",
      "failed sslpassword\n = \r\nsample host=db.example",
      "failed sslpassword\n = \r\n[redacted] host=db.example",
    ],
    [
      "an assignment-shaped suffix inside a prefixed credential",
      "failed sslpassword=sample;tail=first,part=second&end=last sslmode=require",
      "failed sslpassword=[redacted] sslmode=require",
    ],
    [
      "an unterminated quoted credential",
      "failed sslpassword='sample two words",
      "failed sslpassword=[redacted]",
    ],
    [
      "an embedded scheme and an abstract socket host",
      "failed driver_postgres://user:sample@@socket-name/app?sslmode=require",
      "failed driver_postgres://[redacted]@@socket-name/app?sslmode=require",
    ],
    [
      "a database path with a comma before credential-like text",
      "failed postgres://user@db.example/app,sslpassword=reporting?sslmode=require",
      "failed postgres://[redacted]@db.example/app,sslpassword=reporting?sslmode=require",
    ],
    [
      "prefixed credentials nested in diagnostic fields",
      "failed reason=sslpassword=sample error='sslpassword=another host=db.example' dbname=app",
      "failed reason=sslpassword=[redacted] error='sslpassword=[redacted] host=db.example' dbname=app",
    ],
    [
      "quoted credentials inside unquoted diagnostic fields",
      "failed reason=sslpassword='sample tail' error=POSTGRES_PASSWORD=\"another tail\" dbname=app",
      "failed reason=sslpassword=[redacted] error=POSTGRES_PASSWORD=[redacted] dbname=app",
    ],
    [
      "credentials adjacent to square, angle, and quote wrapped connection URIs",
      'failed [postgres://[2001:db8::1]/app];sslpassword=first <postgres://db.example/app>;sslpassword=second "postgres://db.example/app";sslpassword=third',
      'failed [postgres://[2001:db8::1]/app];sslpassword=[redacted] <postgres://db.example/app>;sslpassword=[redacted] "postgres://db.example/app";sslpassword=[redacted]',
    ],
    [
      "an at-sign outside a wrapped URL",
      "failed [postgres://user:sample@db.example];contact=ops@example.test sslmode=require",
      "failed [postgres://[redacted]@db.example];contact=ops@example.test sslmode=require",
    ],
    [
      "literal double quotes in separate connection fields",
      'failed application_name="one sslpassword=sample dbname=app" sslmode=require',
      'failed application_name="one sslpassword=[redacted] dbname=app" sslmode=require',
    ],
    [
      "a leading literal double quote in a connection password",
      'failed sslpassword="sample host=db.example dbname=app',
      "failed sslpassword=[redacted] host=db.example dbname=app",
    ],
    [
      "non-ASCII spacing inside an unquoted connection password",
      "failed sslpassword=sample\u2003tail host=db.example",
      "failed sslpassword=[redacted] host=db.example",
    ],
    [
      "quoted PGPASSWORD without an underscore",
      'failed PGPASSWORD="sample tail" host=db.example',
      "failed PGPASSWORD=[redacted] host=db.example",
    ],
    [
      "credential quotes escaped by a diagnostic field",
      "failed error='sslpassword=\\'sample tail\\' host=db.example' dbname=app",
      "failed error='sslpassword=[redacted] host=db.example' dbname=app",
    ],
    [
      "wrapper-like punctuation inside a bare URL password",
      "failed postgres://user:sample);host=tail@db.example/app postgres://:sample);host=tail@db.example/app",
      "failed postgres://[redacted]@db.example/app postgres://[redacted]@db.example/app",
    ],
    [
      "a comma followed by credential-like text in an unquoted database name",
      "failed host=db.example dbname=app,sslpassword=reporting sslmode=require",
      "failed host=db.example dbname=app,sslpassword=reporting sslmode=require",
    ],
    [
      "quoted uppercase environment credentials without an underscore",
      'failed DBPASSWORD="sample tail" host=db.example',
      "failed DBPASSWORD=[redacted] host=db.example",
    ],
    [
      "wrapper-like punctuation inside an enclosed URL",
      "failed (postgres://user:sample);host=tail@db.example/app);sslpassword=another",
      "failed (postgres://[redacted]@db.example/app);sslpassword=[redacted]",
    ],
    [
      "a raw space inside a password-only URL",
      "failed postgres://:sample tail@db.example/app?sslmode=require",
      "failed postgres://[redacted]@db.example/app?sslmode=require",
    ],
    [
      "a leading space in a password-only URL with a query-provided host",
      "failed postgres://: sample@/app?host=db.example&sslmode=require",
      "failed postgres://[redacted]@/app?host=db.example&sslmode=require",
    ],
    [
      "an at-sign followed by a space in a password-only URL",
      "failed postgres://:sample@ tail@db.example/app",
      "failed postgres://[redacted]@db.example/app",
    ],
    [
      "a quoted environment credential followed by separate fields",
      'failed DBPASSWORD="sample tail";host=db.example;sslmode=require',
      "failed DBPASSWORD=[redacted];host=db.example;sslmode=require",
    ],
    [
      "a prefixed credential after a compact host field",
      "failed host=db.example;sslpassword=sample;sslmode=require",
      "failed host=db.example;sslpassword=[redacted];sslmode=require",
    ],
    [
      "a prefixed credential inside nested diagnostic fields",
      "failed error=\"reason='sslpassword=sample host=db.example'\" sslmode=require",
      "failed error=\"reason='sslpassword=[redacted] host=db.example'\" sslmode=require",
    ],
    [
      "legacy hyphenated keys in delimited diagnostics",
      "failed access-token=sample;host=db.example;dbname=app;sslmode=require",
      "failed access-token=[redacted];host=db.example;dbname=app;sslmode=require",
    ],
    [
      "credentials adjacent to a backtick-wrapped connection URI",
      "failed `postgres://db.example/app`;sslpassword=sample",
      "failed `postgres://db.example/app`;sslpassword=[redacted]",
    ],
  ])("should redact connection failure details for %s", async (_case, message, redactedMessage) => {
    const db = {
      transaction: vi.fn().mockRejectedValue(new Error(message)),
    };
    const indicator = new DrizzleHealthIndicator(db as never);

    await expect(indicator.check()).resolves.toMatchObject({
      status: "down",
      details: { error: redactedMessage },
    });
  });
});
