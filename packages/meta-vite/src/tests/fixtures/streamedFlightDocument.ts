import { RSC_INITIAL_FLIGHT_ATTRIBUTE, RSC_INITIAL_FLIGHT_META_NAME } from "../../libs/rsc/flight";

const BLOCK_PATTERN = new RegExp(
  `<script type="application/json" ${RSC_INITIAL_FLIGHT_ATTRIBUTE}="(chunk|end)">([\\s\\S]*?)</script>`,
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

/**
 * Splits a rendered document into its HTML and the Flight bytes written into it.
 * A block whose closing tag has not arrived yet is left in `html`.
 */
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

type Block = {
  readonly kind: string;
  textContent: string;
  getAttribute(name: string): string | null;
};

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
  /** Callbacks observing one block directly, keyed by the block. */
  readonly blockObservers = new Map<object, Set<() => void>>();

  constructor(private readonly streamed = true) {}

  querySelector(selector: string): { getAttribute(name: string): string | null } | null {
    if (!this.streamed || !selector.includes(RSC_INITIAL_FLIGHT_META_NAME)) {
      return null;
    }
    return { getAttribute: (name) => (name === "content" ? "streamed" : null) };
  }

  // The same objects on every call, as a DOM returns the same elements.
  querySelectorAll(): readonly Block[] {
    return [...this.blocks];
  }

  addEventListener(_type: string, listener: () => void): void {
    this.loaded.add(listener);
  }

  removeEventListener(_type: string, listener: () => void): void {
    this.loaded.delete(listener);
  }

  appendChunk(bytes: readonly number[] | string, text?: string): void {
    const payload = typeof bytes === "string" ? bytes : Buffer.from(bytes).toString("base64");
    this.append("chunk", text ?? JSON.stringify(payload));
  }

  appendEnd(text = "null"): void {
    this.append("end", text);
  }

  /** Completes the text of the last block, as a parser does when more bytes arrive. */
  completeLast(text: string): void {
    const last = this.blocks.at(-1);
    if (last) {
      last.textContent = text;
    }
    this.notify();
  }

  /**
   * Finishes the text of a block that is no longer in the document. Only
   * observers watching that block see it, as with a detached DOM node.
   */
  completeDetached(block: { textContent: string }, text: string): void {
    block.textContent = text;
    for (const observer of this.blockObservers.get(block) ?? []) {
      observer();
    }
  }

  /** Removes every block, as React does when it empties `#root` to re-render it. */
  removeBlocks(): void {
    this.blocks.length = 0;
    this.notify();
  }

  private append(kind: string, textContent: string): void {
    this.blocks.push({
      kind,
      textContent,
      getAttribute: (name) => (name === RSC_INITIAL_FLIGHT_ATTRIBUTE ? kind : null),
    });
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

    observe(target: unknown): void {
      if (target === doc) {
        doc.observers.add(this.callback);
        return;
      }
      const watchers = doc.blockObservers.get(target as object) ?? new Set<() => void>();
      watchers.add(this.callback);
      doc.blockObservers.set(target as object, watchers);
    }

    disconnect(): void {
      doc.observers.delete(this.callback);
      for (const watchers of doc.blockObservers.values()) {
        watchers.delete(this.callback);
      }
    }

    takeRecords(): [] {
      return [];
    }
  } as unknown as typeof MutationObserver;
}
