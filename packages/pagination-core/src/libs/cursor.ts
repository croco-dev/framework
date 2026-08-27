import type { z } from "zod";
import { CURSOR_VERSION } from "./constants";
import { InvalidCursorProblem } from "./problems";
import { CursorPayloadSchema } from "./schemas";
import type { CursorPayload } from "./types";

type CursorBasePayload = {
  v: number;
  id: string;
};

export type CursorCodec<TSchema extends z.ZodType<CursorBasePayload, CursorBasePayload>> = {
  /** Encode a schema output as a versioned URL-safe Base64 cursor. */
  encode(payload: z.output<TSchema>): string;
  /** Decode and validate a versioned cursor as the schema output. */
  decode(cursor: string): z.output<TSchema>;
};

function assertCursorBase(payload: unknown): asserts payload is CursorBasePayload {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new InvalidCursorProblem("Cursor payload is not an object");
  }

  const cursorPayload = payload as Record<string, unknown>;

  if (!("v" in cursorPayload) || typeof cursorPayload.v !== "number") {
    throw new InvalidCursorProblem("Cursor payload missing version field");
  }

  if (cursorPayload.v !== CURSOR_VERSION) {
    throw new InvalidCursorProblem(`Unsupported cursor version: ${cursorPayload.v}`);
  }

  if (!("id" in cursorPayload) || typeof cursorPayload.id !== "string") {
    throw new InvalidCursorProblem("Cursor payload missing id field");
  }
}

function serializeCursor(payload: CursorBasePayload): string {
  let json: string | undefined;
  try {
    json = JSON.stringify(payload);
  } catch {
    throw new InvalidCursorProblem("Cursor payload is not JSON-serializable");
  }
  if (typeof json !== "string") {
    throw new InvalidCursorProblem("Cursor payload is not JSON-serializable");
  }

  const bytes = new TextEncoder().encode(json);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deserializeCursor(cursor: string): unknown {
  if (!cursor || typeof cursor !== "string") {
    throw new InvalidCursorProblem("Cursor is empty or not a string");
  }

  const base64 = toPaddedBase64(cursor);
  if (base64 === undefined) {
    throw new InvalidCursorProblem("Cursor is not valid Base64");
  }

  let json: string;
  try {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new InvalidCursorProblem("Cursor is not valid Base64");
  }

  try {
    return JSON.parse(json) as unknown;
  } catch {
    throw new InvalidCursorProblem("Cursor payload is not valid JSON");
  }
}

function isJsonRoundTripEqual(
  value: unknown,
  wireValue: unknown,
  seen = new WeakSet<object>(),
): boolean {
  try {
    if (value === null || typeof value !== "object") {
      return Object.is(value, wireValue);
    }

    if (wireValue === null || typeof wireValue !== "object" || seen.has(value)) {
      return false;
    }
    seen.add(value);

    try {
      if (Array.isArray(value)) {
        if (
          !Array.isArray(wireValue) ||
          value.length !== wireValue.length ||
          Object.keys(value).length !== value.length ||
          Reflect.ownKeys(value).length !== value.length + 1
        ) {
          return false;
        }
        for (let index = 0; index < value.length; index += 1) {
          if (!Object.prototype.hasOwnProperty.call(value, index)) {
            return false;
          }
        }
        return value.every((item, index) => isJsonRoundTripEqual(item, wireValue[index], seen));
      }

      if (Array.isArray(wireValue)) {
        return false;
      }

      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        return false;
      }

      const keys = Object.keys(value);
      if (Reflect.ownKeys(value).length !== keys.length) {
        return false;
      }

      const wireKeys = Object.keys(wireValue);
      if (
        keys.length !== wireKeys.length ||
        keys.some((key) => !Object.prototype.hasOwnProperty.call(wireValue, key))
      ) {
        return false;
      }

      const record = value as Record<string, unknown>;
      const wireRecord = wireValue as Record<string, unknown>;
      return keys.every((key) => isJsonRoundTripEqual(record[key], wireRecord[key], seen));
    } finally {
      seen.delete(value);
    }
  } catch {
    return false;
  }
}

function encodeWithSchema<TSchema extends z.ZodType<CursorBasePayload, CursorBasePayload>>(
  schema: TSchema,
  payload: z.output<TSchema>,
): z.input<TSchema> {
  try {
    const encoded = schema.safeEncode(payload);
    if (!encoded.success) {
      throw new InvalidCursorProblem("Cursor payload does not match the schema");
    }
    return encoded.data;
  } catch (error) {
    if (error instanceof InvalidCursorProblem) {
      throw error;
    }
    throw new InvalidCursorProblem("Cursor payload does not support encoding");
  }
}

function decodeWithSchema<TSchema extends z.ZodType<CursorBasePayload, CursorBasePayload>>(
  schema: TSchema,
  payload: CursorBasePayload,
): z.output<TSchema> {
  try {
    const decoded = schema.safeDecode(payload as z.input<TSchema>);
    if (!decoded.success) {
      throw new InvalidCursorProblem("Cursor payload does not match the schema");
    }
    return decoded.data;
  } catch (error) {
    if (error instanceof InvalidCursorProblem) {
      throw error;
    }
    throw new InvalidCursorProblem("Cursor payload does not support decoding");
  }
}

/**
 * Create a typed cursor codec backed by a Zod schema.
 *
 * The schema must include the common `v` and `id` fields, and its wire input must survive a JSON
 * roundtrip without loss. Use `z.codec(z.iso.datetime(), z.date(), ...)` for Date outputs and other
 * bidirectional transforms so encoding produces JSON-safe wire values.
 */
export function createCursorCodec<
  const TSchema extends z.ZodType<CursorBasePayload, CursorBasePayload>,
>(schema: TSchema): CursorCodec<TSchema> {
  return {
    encode(payload) {
      const encoded = encodeWithSchema(schema, payload);
      assertCursorBase(encoded);
      const cursor = serializeCursor(encoded);
      const wirePayload = deserializeCursor(cursor);
      assertCursorBase(wirePayload);
      if (!isJsonRoundTripEqual(encoded, wirePayload)) {
        throw new InvalidCursorProblem("Cursor payload is not JSON-safe");
      }
      return cursor;
    },
    decode(cursor) {
      const payload = deserializeCursor(cursor);
      assertCursorBase(payload);
      return decodeWithSchema(schema, payload);
    },
  };
}

const defaultCursorCodec = createCursorCodec(CursorPayloadSchema.loose());

/**
 * Encode a cursor payload to URL-safe Base64 string
 */
export function encodeCursor(payload: CursorPayload): string {
  return serializeCursor(payload);
}

/**
 * Decode a URL-safe Base64 cursor string to payload
 * @throws InvalidCursorProblem if cursor is invalid
 */
export function decodeCursor(cursor: string): CursorPayload {
  return defaultCursorCodec.decode(cursor);
}

function toPaddedBase64(cursor: string): string | undefined {
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(cursor)) {
    return undefined;
  }

  const paddingIndex = cursor.indexOf("=");
  const unpadded = paddingIndex === -1 ? cursor : cursor.slice(0, paddingIndex);
  const remainder = unpadded.length % 4;

  if (remainder === 1) {
    return undefined;
  }

  const requiredPadding = (4 - remainder) % 4;
  const existingPadding = cursor.length - unpadded.length;

  if (existingPadding !== 0 && existingPadding !== requiredPadding) {
    return undefined;
  }

  return `${unpadded.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat(requiredPadding)}`;
}
