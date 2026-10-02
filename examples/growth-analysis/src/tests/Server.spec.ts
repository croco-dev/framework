import { Readable } from "node:stream";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";

const fixture = vi.hoisted(() => ({
  propose: vi.fn(),
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

async function post(error: unknown, destroyed = false) {
  fixture.propose.mockRejectedValueOnce(error);
  const request = Object.assign(Readable.from(['"question"']), {
    method: "POST",
    url: "/propose",
  });
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

beforeEach(async () => {
  fixture.propose.mockReset();
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
