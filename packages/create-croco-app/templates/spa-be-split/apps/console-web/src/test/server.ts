import { HttpResponse, http } from "msw";
import { setupWorker } from "msw/browser";

export const problemFixture = {
  type: "https://example.test/problems/service-unavailable",
  title: "User service unavailable",
  status: 503,
  detail: "The user service is temporarily unavailable.",
  code: "starter/user-service-unavailable",
  recovery: "Retry after the service recovers.",
} as const;

export const server = setupWorker(
  http.get("/api/testing/problem", () =>
    HttpResponse.json(problemFixture, {
      status: problemFixture.status,
      headers: { "Content-Type": "application/problem+json" },
    }),
  ),
);
