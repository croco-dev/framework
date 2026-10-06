import { afterEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
const mocks = vi.hoisted(() => ({
  handler: undefined as undefined | ((req: IncomingMessage, res: ServerResponse) => Promise<void>),
  readReport: vi.fn(),
  listen: vi.fn(),
}));
vi.mock("node:http", () => ({
  createServer: (handler: typeof mocks.handler) => {
    mocks.handler = handler;
    return { listen: mocks.listen, close: vi.fn() };
  },
}));
vi.mock("node:fs/promises", () => ({ readFile: vi.fn().mockResolvedValue(Buffer.from("")) }));
vi.mock("../database", () => ({ database: {}, pool: { end: vi.fn() } }));
vi.mock("../reports", () => ({
  canRead: vi.fn(),
  reportResolver: vi.fn(),
  readReport: mocks.readReport,
}));
vi.mock("@croco/experience-core", () => ({
  createSavedIntentService: vi.fn(),
  SavedIntentInvalidProblem: Error,
}));
vi.mock("@croco/experience-drizzle", () => ({ PostgresSavedIntentStore: class {} }));
vi.mock("@croco/admin-core", () => ({ SavedIntentOperations: class {} }));
afterEach(() => vi.restoreAllMocks());
describe("report destination", () => {
  it("denies malformed encoded identifiers before reading any report", async () => {
    vi.spyOn(process, "on").mockReturnValue(process);
    await import("../server");
    await vi.waitFor(() => expect(mocks.listen).toHaveBeenCalled());
    if (!mocks.handler) throw new Error("HTTP handler was not installed");
    const end = vi.fn();
    const response = { setHeader: vi.fn(), end, statusCode: 200 };
    await mocks.handler(
      { method: "GET", url: "/reports/%E0%A4%A" } as IncomingMessage,
      response as unknown as ServerResponse,
    );
    expect(response.statusCode).toBe(403);
    expect(end).toHaveBeenCalledWith("Report unavailable");
    expect(mocks.readReport).not.toHaveBeenCalled();
  });
});
