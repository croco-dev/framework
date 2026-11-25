import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import { sanitizeAuditValue } from "../libs/sanitizeAuditValue";

describe("sanitizeAuditValue", () => {
  it.each([
    ["Authorization=ExampleAuth fixture-value", "Authorization=[Redacted]"],
    ["Proxy-Authorization: ExampleAuth fixture-value", "Proxy-Authorization: [Redacted]"],
    [
      '{"authorization":"ExampleAuth proof=\\"fixture-value\\"","operation":"list"}',
      '{"authorization":"[Redacted]","operation":"list"}',
    ],
    ["request recommends digest authentication", "request recommends digest authentication"],
    ["Authorization: \r\nrequest ID: abc", "Authorization: \r\nrequest ID: abc"],
    ["Authorization: Bearer\r\n\tfixture-value", "Authorization: [Redacted]"],
    ["Authorization: Bearer\r\n \r\n\tfixture-value", "Authorization: [Redacted]"],
    [
      inspect({ Authorization: null, requestId: "abc" }),
      "{ Authorization: null, requestId: 'abc' }",
    ],
    [
      inspect({ requestId: "abc", "Proxy-Authorization": null }),
      "{ requestId: 'abc', 'Proxy-Authorization': null }",
    ],
    [
      inspect({ Authorization: 'Digest realm="fixture"', requestId: "abc" }),
      "{ Authorization: '[Redacted]', requestId: 'abc' }",
    ],
    ["Authorization: null , proof=fixture-value", "Authorization: [Redacted]"],
    ["Proxy-Authorization:\r\n ExampleAuth fixture-value", "Proxy-Authorization:\r\n [Redacted]"],
    ["Authorization: 'ExampleAuth' fixture-value", "Authorization: [Redacted]"],
    ["Authorization: 'ExampleAuth'\r\n\tfixture-value", "Authorization: [Redacted]"],
    ["Authorization: 'ExampleAuth proof=fixture'part, id=fixture-id", "Authorization: [Redacted]"],
    [
      "Authorization: 'ExampleAuth , proof*\r\n\t=fixture'part, id=fixture-id",
      "Authorization: [Redacted]",
    ],
    ["Authorization='fixture-value' operation=list", "Authorization='[Redacted]' operation=list"],
    ["Authorization='Example'Auth fixture-value", "Authorization=[Redacted]"],
    [
      "Authorization: 'Bearer fixture-value' request ID: abc",
      "Authorization: '[Redacted]' request ID: abc",
    ],
    [
      "{'Authorization': 'Bearer fixture-value', 'requestId': 'abc'}",
      "{'Authorization': '[Redacted]', 'requestId': 'abc'}",
    ],
    [
      '{"Authorization"\n:\n"ExampleAuth fixture-value", "requestId": "abc"}',
      '{"Authorization"\n:\n"[Redacted]", "requestId": "abc"}',
    ],
    [
      "{ message: 'upstream\\nAuthorization: ExampleAuth fixture-value\\nrequest ID: abc' }",
      "{ message: 'upstream\\nAuthorization: [Redacted]\\nrequest ID: abc' }",
    ],
    [
      inspect("upstream\x1b\nAuthorization: ExampleAuth fixture-value\nrequest ID: abc"),
      "'upstream\\u001b\\nAuthorization: [Redacted]\\nrequest ID: abc'",
    ],
    [
      inspect("Authorization: ExampleAuth fixture-value\nupstream said \"ready\" at 'start'"),
      "`Authorization: [Redacted]\\nupstream said \"ready\" at 'start'`",
    ],
    [
      inspect(
        `upstream ${"x".repeat(80)}\nAuthorization: Bearer\r\n\tfixture-value\nrequest ID: abc`,
      ),
      `'upstream ${"x".repeat(80)}\\nAuthorization: [Redacted]\\nrequest ID: abc'`,
    ],
    [
      '{"message":"upstream Proxy-Authorization: ExampleAuth fixture-value","operation":"list"}',
      '{"message":"upstream Proxy-Authorization: [Redacted]","operation":"list"}',
    ],
    [
      '"Authorization: Bearer fixture-value" request ID: abc',
      '"Authorization: [Redacted]" request ID: abc',
    ],
    [
      JSON.stringify({
        message: 'upstream\n"Authorization: ExampleAuth fixture-value" request ID: abc',
      }),
      JSON.stringify({ message: 'upstream\n"Authorization: [Redacted]" request ID: abc' }),
    ],
    [
      JSON.stringify({
        message: "upstream\nAuthorization: ExampleAuth fixture-value\nrequest ID: abc",
      }),
      JSON.stringify({ message: "upstream\nAuthorization: [Redacted]\nrequest ID: abc" }),
    ],
    [
      "Headers:\r\n  Authorization: Bearer fixture-value\r\n  Cookie: sid=fixture-cookie\r\n  X-Request-Id: abc",
      "Headers:\r\n  Authorization: [Redacted]\r\n  Cookie: [Redacted]\r\n  X-Request-Id: abc",
    ],
    [
      "request.authorization=fixture-value; request ID: abc",
      "request.authorization=[Redacted]; request ID: abc",
    ],
    ["Credential=Basic fixture-value", "Credential=[Redacted]"],
  ])("sanitizes audit message %s", (message, expected) => {
    expect(sanitizeAuditValue(message)).toBe(expected);
  });

  it.each([
    [BigInt("0"), "0"],
    [BigInt("-1"), "-1"],
    [BigInt("9007199254740993123456789"), "9007199254740993123456789"],
    [BigInt("-9007199254740993123456789"), "-9007199254740993123456789"],
  ])("preserves bigint %s as an exact decimal string", (value, expected) => {
    expect(sanitizeAuditValue(value)).toBe(expected);
    expect(JSON.stringify(sanitizeAuditValue(value))).toBe(JSON.stringify(expected));
  });

  it("normalizes nested bigint without bypassing redaction, accessors or cycles", () => {
    const getter = () => {
      throw new Error("accessor must not execute");
    };
    const input: Record<string, unknown> = {
      total: BigInt("9007199254740993"),
      items: [{ delta: BigInt("-9007199254740995") }, BigInt("0")],
      accessToken: BigInt("123456789"),
    };
    input.self = input;
    Object.defineProperty(input, "displayName", { enumerable: true, get: getter });

    const snapshot = sanitizeAuditValue(input);
    expect(snapshot).toEqual({
      total: "9007199254740993",
      items: [{ delta: "-9007199254740995" }, "0"],
      accessToken: "[Redacted]",
      self: "[Circular]",
      displayName: "[Accessor]",
    });
    expect(() => JSON.stringify(snapshot)).not.toThrow();
    expect(input.total).toBe(BigInt("9007199254740993"));
    expect(input.accessToken).toBe(BigInt("123456789"));
  });
});
