import { Readable } from "node:stream";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";

const fixture = vi.hoisted(() => ({
  propose: vi.fn(),
  readFile: vi.fn(),
  handler: undefined as
    | ((request: IncomingMessage, response: ServerResponse) => Promise<void>)
    | undefined,
}));
vi.mock("node:http", () => ({
  createServer: (handler: typeof fixture.handler) => {
    fixture.handler = handler;
    return { listen: vi.fn() };
  },
}));
vi.mock("node:fs/promises", () => ({ readFile: fixture.readFile }));
vi.mock("../localProvider", () => ({
  startLocalProvider: async () => ({ baseURL: "http://127.0.0.1:1" }),
}));
vi.mock("../openai", () => ({ createOpenAIPlanProposal: vi.fn() }));
vi.mock("../fixture", () => ({
  createFixture: () => ({ service: { propose: fixture.propose } }),
}));

class FixtureProblem extends Problem {
  constructor(category: ProblemCategory) {
    super("fixture/failure", category, "Safe synthetic detail", {
      cause: new Error("private-provider-cause"),
    });
  }
}

async function requestResponse(
  method: string,
  url: string,
  chunks: readonly Buffer[] = [],
  destroyed = false,
) {
  const request = Object.assign(Readable.from(chunks), { method, url });
  const response = {
    destroyed,
    on: vi.fn(),
    writeHead: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  };
  if (!fixture.handler) throw new Error("Server handler was not registered");
  await fixture.handler(request as IncomingMessage, response as unknown as ServerResponse);
  return response;
}

async function post(error: unknown, destroyed = false) {
  fixture.propose.mockRejectedValueOnce(error);
  return requestResponse("POST", "/propose", [Buffer.from('"question"')], destroyed);
}

beforeEach(async () => {
  fixture.propose.mockReset();
  fixture.readFile.mockReset();
  await import("../server");
});

describe("growth analysis HTTP failure responses", () => {
  it.each([
    [ProblemCategory.Forbidden, 403],
    [ProblemCategory.TooManyRequests, 429],
    [ProblemCategory.InternalServerError, 500],
  ] as const)("preserves %s Problem status and safe JSON", async (category, status) => {
    const problem = new FixtureProblem(category);
    const response = await post(problem);
    expect(response.writeHead).toHaveBeenCalledWith(status, {
      "content-type": "application/json",
    });
    expect(response.end).toHaveBeenCalledWith(JSON.stringify(problem.toJSON()));
    expect(response.end.mock.calls[0][0]).not.toContain("private-provider-cause");
  });

  it("uses a stable 500 response for unknown errors without exposing their content", async () => {
    const response = await post(new Error("private-customer-content"));
    expect(response.writeHead).toHaveBeenCalledWith(500, {
      "content-type": "application/json",
    });
    expect(response.end).toHaveBeenCalledWith('{"code":"DEMO_ANALYSIS_FAILED"}');
  });

  it("does not write to a destroyed response", async () => {
    const response = await post(new Error("private-content"), true);
    expect(response.writeHead).not.toHaveBeenCalled();
    expect(response.end).not.toHaveBeenCalled();
  });
});

describe("growth analysis static files and request bytes", () => {
  it.each(["/", "/dist/browser.global.js"])(
    "returns a safe 500 when %s is missing",
    async (path) => {
      fixture.readFile.mockRejectedValueOnce(new Error("ENOENT private-local-path"));
      const response = await requestResponse("GET", path);
      expect(response.writeHead).toHaveBeenCalledWith(500, { "content-type": "application/json" });
      expect(response.end).toHaveBeenCalledWith('{"code":"DEMO_ANALYSIS_FAILED"}');
    },
  );

  it.each(["/", "/dist/browser.global.js"])(
    "does not write a missing %s error to a destroyed response",
    async (path) => {
      fixture.readFile.mockRejectedValueOnce(new Error("ENOENT private-local-path"));
      const response = await requestResponse("GET", path, [], true);
      expect(response.writeHead).not.toHaveBeenCalled();
      expect(response.end).not.toHaveBeenCalled();
    },
  );

  it("decodes a Korean JSON question once after collecting split UTF-8 bytes", async () => {
    const question = "구월 활성화율은 얼마인가요?";
    const bytes = Buffer.from(JSON.stringify(question));
    fixture.propose.mockResolvedValueOnce({ status: "unavailable" });
    const response = await requestResponse("POST", "/propose", [
      bytes.subarray(0, 2),
      bytes.subarray(2, 3),
      bytes.subarray(3),
    ]);
    expect(fixture.propose).toHaveBeenCalledWith(question, expect.any(AbortSignal));
    expect(response.writeHead).toHaveBeenCalledWith(200, { "content-type": "application/json" });
  });

  it.each([8192, 8193])(
    "bounds the original %i bytes even when a multibyte character crosses chunks",
    async (length) => {
      const question = "한" + "a".repeat(length - 5);
      const bytes = Buffer.from(JSON.stringify(question));
      expect(bytes.byteLength).toBe(length);
      fixture.propose.mockResolvedValueOnce({ status: "unavailable" });
      const response = await requestResponse("POST", "/propose", [
        bytes.subarray(0, 2),
        bytes.subarray(2),
      ]);
      if (length === 8192) {
        expect(fixture.propose).toHaveBeenCalledWith(question, expect.any(AbortSignal));
        expect(response.writeHead).toHaveBeenCalledWith(200, {
          "content-type": "application/json",
        });
      } else {
        expect(fixture.propose).not.toHaveBeenCalled();
        expect(response.writeHead).toHaveBeenCalledWith(413);
      }
    },
  );
});
