import { Buffer as NodeBuffer } from "node:buffer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeCursor, encodeCursor } from "../libs/cursor";
import { InvalidCursorProblem } from "../libs/problems";
import type { CursorPayload } from "../libs/types";

describe("cursor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should roundtrip encode and decode", () => {
    const payload = { v: 1, id: "usr_01HXYZ" };
    const encoded = encodeCursor(payload);
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual(payload);
  });

  it("should encode to URL-safe Base64 (no + or /)", () => {
    const payload = { v: 1, id: "test+++///" };
    const encoded = encodeCursor(payload);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
  });

  it("should decode compound key payload", () => {
    const payload = { v: 1, id: "xxx", createdAt: "2025-01-01" };
    const encoded = encodeCursor(payload);
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual(payload);
  });

  it("should preserve compatibility with Node base64url cursors", () => {
    const payload = { v: 1, id: "사용자_🐊", createdAt: "2026-08-27T12:34:56.000Z" };
    const nodeCursor = NodeBuffer.from(JSON.stringify(payload), "utf-8").toString("base64url");

    expect(encodeCursor(payload)).toBe(nodeCursor);
    expect(decodeCursor(nodeCursor)).toEqual(payload);
    expect(NodeBuffer.from(encodeCursor(payload), "base64url").toString("utf-8")).toBe(
      JSON.stringify(payload),
    );
  });

  it("should roundtrip without the Node Buffer global", () => {
    vi.stubGlobal("Buffer", undefined);
    const payload = { v: 1, id: "edge_🐊" };

    const encoded = encodeCursor(payload);

    expect(encoded).toBe("eyJ2IjoxLCJpZCI6ImVkZ2Vf8J-QiiJ9");
    expect(decodeCursor(encoded)).toEqual(payload);
  });

  it("should reject payloads that do not serialize to JSON", () => {
    const payload = {
      v: 1,
      id: "invalid",
      toJSON: () => undefined,
    } as unknown as CursorPayload;

    expect(() => encodeCursor(payload)).toThrow(InvalidCursorProblem);
  });

  it("should throw InvalidCursorProblem for malformed Base64", () => {
    expect(() => decodeCursor("not-base64!!!")).toThrow(InvalidCursorProblem);
  });

  it("should throw InvalidCursorProblem for valid Base64 but non-JSON", () => {
    expect(() => decodeCursor("aGVsbG8=")).toThrow(InvalidCursorProblem); // "hello" in base64
  });

  it("should throw InvalidCursorProblem for JSON without v field", () => {
    const invalidJson = NodeBuffer.from(JSON.stringify({ id: "test" })).toString("base64url");
    expect(() => decodeCursor(invalidJson)).toThrow(InvalidCursorProblem);
  });

  it("should throw InvalidCursorProblem for unsupported version", () => {
    const payload = { v: 99, id: "test" };
    const encoded = encodeCursor(payload);
    expect(() => decodeCursor(encoded)).toThrow(InvalidCursorProblem);
  });

  it("should throw InvalidCursorProblem for empty string", () => {
    expect(() => decodeCursor("")).toThrow(InvalidCursorProblem);
  });
});
