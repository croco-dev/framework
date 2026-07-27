import "vitest-browser-react";

import { Problem, ProblemCategory } from "@croco/problems-core";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

class UnhandledApiRequestProblem extends Problem {
  readonly code = "starter/unhandled-api-request";
  readonly category = ProblemCategory.InternalServerError;

  constructor(method: string, url: string) {
    super(
      undefined,
      undefined,
      `[MSW] Unhandled API request escaped its fixture: ${method} ${url}`,
    );
  }
}

beforeAll(async () => {
  await server.start({
    onUnhandledRequest(request) {
      throw new UnhandledApiRequestProblem(request.method, request.url);
    },
    quiet: true,
  });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.stop();
});
