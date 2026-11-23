import { RSC_INITIAL_FLIGHT_ATTRIBUTE, RSC_INITIAL_FLIGHT_META_NAME } from "../../libs/rsc/flight";

const BLOCK_PATTERN = new RegExp(
  `<script type="application/json" ${RSC_INITIAL_FLIGHT_ATTRIBUTE}="(chunk|end)">([\\s\\S]*?)(?:</script>|$)`,
  "g",
);

export type StreamedFlightParts = {
  /** The document with every Flight block removed. */
  readonly html: string;
  readonly flight: Uint8Array;
  readonly ended: boolean;
  /** Where each block started in the original document. */
  readonly blockOffsets: readonly number[];
};

/** Splits a rendered document into its HTML and the Flight bytes written into it. */
export function splitStreamedFlight(document: string): StreamedFlightParts {
  const chunks: Buffer[] = [];
  const blockOffsets: number[] = [];
  let ended = false;
  for (const match of document.matchAll(BLOCK_PATTERN)) {
    blockOffsets.push(match.index);
    if (match[1] === "end") {
      ended = true;
    } else {
      chunks.push(Buffer.from(JSON.parse(match[2] ?? '""') as string, "base64"));
    }
  }
  return {
    html: document.replace(BLOCK_PATTERN, ""),
    flight: new Uint8Array(Buffer.concat(chunks)),
    ended,
    blockOffsets,
  };
}

type Block = { readonly kind: string; readonly text: string };

/**
 * The parts of a loading document `readRscInitialFlight` reads, fed by a test
 * one parser step at a time. Mutation callbacks run when the test appends,
 * which is when a browser's parser would insert the node.
 */
export class StreamedFlightDocument {
  readyState: "loading" | "complete" = "loading";
  private readonly blocks: Block[] = [];
  private readonly loaded = new Set<() => void>();
  readonly observers = new Set<() => void>();

  constructor(private readonly streamed = true) {}

  querySelector(selector: string): { getAttribute(name: string): string | null } | null {
    if (!this.streamed || !selector.includes(RSC_INITIAL_FLIGHT_META_NAME)) {
      return null;
    }
    return { getAttribute: (name) => (name === "content" ? "streamed" : null) };
  }

  querySelectorAll(): readonly {
    readonly textContent: string;
    getAttribute(name: string): string | null;
  }[] {
    return this.blocks.map((block) => ({
      textContent: block.text,
      getAttribute: (name) => (name === RSC_INITIAL_FLIGHT_ATTRIBUTE ? block.kind : null),
    }));
  }

  addEventListener(_type: string, listener: () => void): void {
    this.loaded.add(listener);
  }

  removeEventListener(_type: string, listener: () => void): void {
    this.loaded.delete(listener);
  }

  appendChunk(bytes: readonly number[] | string, text?: string): void {
    const payload = typeof bytes === "string" ? bytes : Buffer.from(bytes).toString("base64");
    this.blocks.push({ kind: "chunk", text: text ?? JSON.stringify(payload) });
    this.notify();
  }

  appendEnd(text = "null"): void {
    this.blocks.push({ kind: "end", text });
    this.notify();
  }

  /** Completes the text of the last block, as a parser does when more bytes arrive. */
  completeLast(text: string): void {
    const last = this.blocks.pop();
    if (last) {
      this.blocks.push({ kind: last.kind, text });
    }
    this.notify();
  }

  finishLoading(): void {
    this.readyState = "complete";
    for (const listener of this.loaded) {
      listener();
    }
  }

  private notify(): void {
    for (const observer of this.observers) {
      observer();
    }
  }
}

/** A `MutationObserver` stand-in that reports every change the fake document makes. */
export function mutationObserverFor(doc: StreamedFlightDocument): typeof MutationObserver {
  return class {
    private readonly callback: () => void;

    constructor(callback: () => void) {
      this.callback = callback;
    }

    observe(): void {
      doc.observers.add(this.callback);
    }

    disconnect(): void {
      doc.observers.delete(this.callback);
    }

    takeRecords(): [] {
      return [];
    }
  } as unknown as typeof MutationObserver;
}
