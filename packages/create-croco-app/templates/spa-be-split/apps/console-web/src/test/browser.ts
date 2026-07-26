import "vitest-browser-react";

import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

beforeAll(async () => {
  await server.start({
    onUnhandledRequest(request) {
      throw new Error(
        `[MSW] Unhandled API request escaped its fixture: ${request.method} ${request.url}`,
      );
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
