import { SourceDecodeProblem } from "./SourceDecodeProblem";
import type { SourceLimits, SourcePosition } from "./types";

export type SourceCharacter = {
  readonly value: string;
  readonly position: SourcePosition;
  readonly byteLength: number;
};

export async function* decodeCharacters(
  bytes: AsyncIterable<Uint8Array>,
  limits: SourceLimits,
): AsyncGenerator<SourceCharacter> {
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  const encoder = new TextEncoder();
  let position: SourcePosition = { byteOffset: 0, line: 1, column: 1 };
  let received = 0;
  let previousWasCR = false;
  let first = true;
  let pending = new Uint8Array(0);

  function* emit(text: string): Generator<SourceCharacter> {
    for (const value of text) {
      const byteLength = encoder.encode(value).byteLength;
      const current = position;
      if (first && value === "\uFEFF") {
        first = false;
        position = { ...current, byteOffset: current.byteOffset + byteLength };
        continue;
      }
      position = {
        byteOffset: current.byteOffset + byteLength,
        line:
          value === "\r" || (value === "\n" && !previousWasCR) ? current.line + 1 : current.line,
        column: value === "\r" || value === "\n" ? 1 : current.column + 1,
      };
      previousWasCR = value === "\r";
      first = false;
      yield { value, position: current, byteLength };
    }
  }

  for await (const chunk of bytes) {
    if (received + chunk.byteLength > limits.maxBytes) {
      throw new SourceDecodeProblem(
        "byte-limit",
        position,
        `Source exceeds ${limits.maxBytes} bytes`,
      );
    }
    let decoded: string;
    try {
      decoded = decoder.decode(chunk, { stream: true });
    } catch {
      const probe = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
      probe.decode(pending, { stream: true });
      for (const byte of chunk) {
        try {
          yield* emit(probe.decode(Uint8Array.of(byte), { stream: true }));
        } catch {
          throw new SourceDecodeProblem("invalid-utf8", position, "Source contains invalid UTF-8");
        }
      }
      throw new SourceDecodeProblem("invalid-utf8", position, "Source contains invalid UTF-8");
    }
    yield* emit(decoded);
    received += chunk.byteLength;
    const pendingCount = received - position.byteOffset;
    if (pendingCount <= chunk.byteLength) {
      pending = chunk.slice(chunk.byteLength - pendingCount);
    } else {
      const carried = pending.slice(pending.byteLength - (pendingCount - chunk.byteLength));
      pending = new Uint8Array(pendingCount);
      pending.set(carried);
      pending.set(chunk, carried.byteLength);
    }
  }
  try {
    yield* emit(decoder.decode());
  } catch {
    throw new SourceDecodeProblem("invalid-utf8", position, "Source ends with incomplete UTF-8");
  }
}
