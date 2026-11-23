import { afterEach, describe, expect, it, vi } from "vitest";
import { RscInitialFlightIncompleteProblem, readRscInitialFlight } from "../libs/rsc/flight";
import { StreamedFlightDocument, mutationObserverFor } from "./fixtures/streamedFlightDocument";

function open(doc: StreamedFlightDocument): ReadableStreamDefaultReader<Uint8Array> {
  vi.stubGlobal("MutationObserver", mutationObserverFor(doc));
  const stream = readRscInitialFlight(doc as unknown as Document);
  if (!stream) {
    throw new Error("expected a streamed Flight payload");
  }
  return stream.getReader();
}

async function pending<T>(promise: Promise<T>): Promise<boolean> {
  const marker = Symbol("pending");
  const settled = await Promise.race([
    promise,
    new Promise((resolve) => setImmediate(resolve, marker)),
  ]);
  return settled === marker;
}

describe("readRscInitialFlight", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null for a document without a streamed payload", () => {
    const doc = new StreamedFlightDocument(false);
    vi.stubGlobal("MutationObserver", mutationObserverFor(doc));

    expect(readRscInitialFlight(doc as unknown as Document)).toBeNull();
  });

  it("hands over the rows parsed so far and waits for the ones still streaming", async () => {
    const doc = new StreamedFlightDocument();
    doc.appendChunk([0x30, 0x3a]);
    const reader = open(doc);

    expect([...((await reader.read()).value ?? [])]).toEqual([0x30, 0x3a]);
    const next = reader.read();
    expect(await pending(next)).toBe(true);

    doc.appendChunk([0xff, 0x00, 0x0a]);
    expect([...((await next).value ?? [])]).toEqual([0xff, 0x00, 0x0a]);

    doc.appendEnd();
    expect(await reader.read()).toEqual({ done: true, value: undefined });
    expect(doc.observers.size).toBe(0);
  });

  it("waits for a block whose text the parser has not finished", async () => {
    const doc = new StreamedFlightDocument();
    doc.appendChunk("", '"QUJD');
    const reader = open(doc);

    const first = reader.read();
    expect(await pending(first)).toBe(true);

    doc.completeLast('"QUJDRA=="');
    expect(new TextDecoder().decode((await first).value)).toBe("ABCD");
  });

  it("waits for the end block to be complete before closing", async () => {
    const doc = new StreamedFlightDocument();
    doc.appendEnd("nu");
    const reader = open(doc);

    const done = reader.read();
    expect(await pending(done)).toBe(true);

    doc.completeLast("null");
    expect((await done).done).toBe(true);
  });

  it("fails when the document ends before the payload is complete", async () => {
    const doc = new StreamedFlightDocument();
    doc.appendChunk([0x30]);
    const reader = open(doc);
    await reader.read();

    const next = reader.read();
    doc.finishLoading();

    await expect(next).rejects.toThrow(RscInitialFlightIncompleteProblem);
    expect(doc.observers.size).toBe(0);
  });

  it("reads a payload that was complete before the client entry ran", async () => {
    const doc = new StreamedFlightDocument();
    doc.appendChunk([0x31]);
    doc.appendEnd();
    doc.finishLoading();

    const reader = open(doc);

    expect([...((await reader.read()).value ?? [])]).toEqual([0x31]);
    expect((await reader.read()).done).toBe(true);
  });

  it("stops watching the document when the consumer cancels", async () => {
    const doc = new StreamedFlightDocument();
    const reader = open(doc);

    await reader.cancel("navigated-away");

    expect(doc.observers.size).toBe(0);
  });
});
