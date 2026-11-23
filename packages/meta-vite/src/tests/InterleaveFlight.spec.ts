import { describe, expect, it } from "vitest";
import { RSC_INITIAL_FLIGHT_ATTRIBUTE } from "../libs/rsc/flight";
import { FLIGHT_BLOCK_ATTRIBUTE, interleaveFlight } from "../libs/rsc/rscBuildWorker.mjs";
import { splitStreamedFlight } from "./fixtures/streamedFlightDocument";

const encoder = new TextEncoder();

type Source = {
  readonly stream: ReadableStream<Uint8Array>;
  readonly enqueue: (...chunks: string[]) => void;
  readonly close: () => void;
  readonly error: (reason: unknown) => void;
  readonly cancelled: unknown[];
};

// Enqueues every chunk of one call in the same task, as React does for the
// chunks of one flush.
function source(): Source {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const cancelled: unknown[] = [];
  const stream = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
    },
    cancel(reason) {
      cancelled.push(reason);
    },
  });
  return {
    stream,
    enqueue: (...chunks) => {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
    },
    close: () => controller.close(),
    error: (reason) => controller.error(reason),
    cancelled,
  };
}

const nextTask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

async function readAll(
  stream: ReadableStream<Uint8Array>,
  { delayEachRead = false } = {},
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    if (delayEachRead) {
      await nextTask();
    }
    const { done, value } = await reader.read();
    if (done) {
      return text;
    }
    text += decoder.decode(value, { stream: true });
  }
}

describe("interleaveFlight", () => {
  it("uses the block attribute the browser reader looks for", () => {
    expect(FLIGHT_BLOCK_ATTRIBUTE).toBe(RSC_INITIAL_FLIGHT_ATTRIBUTE);
  });

  for (const delayEachRead of [false, true]) {
    it(`writes Flight only between whole flushes and after the shell (slow consumer: ${delayEachRead})`, async () => {
      const html = source();
      const flight = source();
      const document = readAll(interleaveFlight(html.stream, flight.stream), { delayEachRead });

      flight.enqueue("0:shell-row\n");
      // One flush split inside a tag, the way React may cut its view buffer.
      html.enqueue("<main><style>p{color:red", "}</style><p cla", 'ss="cta">shell</p></main>');
      await nextTask();
      flight.enqueue("1:late-row\n");
      await nextTask();
      html.enqueue('<div hidden id="S:0"><p>la', "te</p></div>");
      html.close();
      flight.close();

      const output = await document;
      const parts = splitStreamedFlight(output);

      expect(parts.html).toBe(
        '<main><style>p{color:red}</style><p class="cta">shell</p></main><div hidden id="S:0"><p>late</p></div>',
      );
      expect(new TextDecoder().decode(parts.flight)).toBe("0:shell-row\n1:late-row\n");
      expect(parts.ended).toBe(true);
      expect(output.indexOf("shell</p></main>")).toBeLessThan(parts.blockOffsets[0] ?? -1);
      expect(output).toContain('<div hidden id="S:0"><p>late</p></div>');
      expect(output.endsWith(`${RSC_INITIAL_FLIGHT_ATTRIBUTE}="end">null</script>`)).toBe(true);
    });
  }

  it("holds Flight rows that arrive before the shell until the shell is out", async () => {
    const html = source();
    const flight = source();
    const document = readAll(interleaveFlight(html.stream, flight.stream));

    flight.enqueue("0:a\n");
    await nextTask();
    flight.enqueue("1:b\n");
    flight.close();
    await nextTask();
    html.enqueue("<p>", "shell</p>");
    html.close();

    const output = await document;
    expect(output.startsWith("<p>shell</p><script")).toBe(true);
    expect(new TextDecoder().decode(splitStreamedFlight(output).flight)).toBe("0:a\n1:b\n");
  });

  it("carries a large payload with markup-like text without letting it into the HTML", async () => {
    const html = source();
    const flight = source();
    const document = readAll(interleaveFlight(html.stream, flight.stream), { delayEachRead: true });
    const hostile = "</script><!--<script>alert(1)</script>\u2028·’";
    const rows = Array.from(
      { length: 40 },
      (_, index) => `${index}:${hostile}${"x".repeat(8_000)}\n`,
    );

    html.enqueue("<main>", "shell</main>");
    for (const [index, row] of rows.entries()) {
      flight.enqueue(row);
      if (index % 10 === 9) {
        await nextTask();
        html.enqueue(`<div hidden id="S:${index}">`, "late</div>");
      }
    }
    flight.close();
    await nextTask();
    html.close();

    const output = await document;
    const parts = splitStreamedFlight(output);
    expect(new TextDecoder().decode(parts.flight)).toBe(rows.join(""));
    expect(parts.flight.length).toBeGreaterThan(300_000);
    expect(output).not.toContain("alert(1)");
    expect(parts.ended).toBe(true);
  });

  it("keeps bytes that are not valid UTF-8 intact", async () => {
    const html = source();
    const flight = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([0x30, 0x3a, 0xff, 0xfe, 0x00, 0x0a]));
        controller.close();
      },
    });
    const document = readAll(interleaveFlight(html.stream, flight));
    html.enqueue("<p>x</p>");
    html.close();

    expect([...splitStreamedFlight(await document).flight]).toEqual([
      0x30, 0x3a, 0xff, 0xfe, 0x00, 0x0a,
    ]);
  });

  it("cancels both the HTML and the Flight source when the consumer leaves", async () => {
    const html = source();
    const flight = source();
    const reader = interleaveFlight(html.stream, flight.stream).getReader();
    html.enqueue("<p>shell</p>");
    await reader.read();

    await reader.cancel("navigated-away");

    expect(html.cancelled).toEqual(["navigated-away"]);
    expect(flight.cancelled).toEqual(["navigated-away"]);
  });

  it("fails the document and releases the Flight source when the HTML fails", async () => {
    const html = source();
    const flight = source();
    const reader = interleaveFlight(html.stream, flight.stream).getReader();
    html.enqueue("<p>shell</p>");
    await reader.read();

    const next = reader.read();
    html.error(new Error("boundary failed"));

    await expect(next).rejects.toThrow("boundary failed");
    expect(flight.cancelled).toHaveLength(1);
  });
});
