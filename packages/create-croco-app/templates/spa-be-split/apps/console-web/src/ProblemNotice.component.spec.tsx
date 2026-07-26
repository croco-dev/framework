import { useEffect, useState } from "react";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { ProblemNotice, type FrontendProblem } from "./ProblemNotice";
import { request } from "./api/client";
import { toFrontendProblem } from "./api/useUsers";
import { problemFixture } from "./test/server";

function ProblemProbe() {
  const [problem, setProblem] = useState<FrontendProblem>();

  useEffect(() => {
    void request("/testing/problem").catch((caught: unknown) => {
      setProblem(toFrontendProblem(caught, "The request failed."));
    });
  }, []);

  return problem ? <ProblemNotice problem={problem} /> : <p>Loading problem fixture...</p>;
}

test("renders Problem code, status, detail, and recovery from the MSW API boundary", async () => {
  const screen = await render(<ProblemProbe />);

  await expect.element(screen.getByRole("alert")).toBeVisible();
  await expect.element(screen.getByText(problemFixture.code)).toBeVisible();
  await expect.element(screen.getByText(String(problemFixture.status))).toBeVisible();
  await expect.element(screen.getByText(problemFixture.detail)).toBeVisible();
  await expect.element(screen.getByText(problemFixture.recovery)).toBeVisible();
});

test("exposes a user interaction helper for recovery", async () => {
  const onRetry = vi.fn();
  const problem = {
    code: problemFixture.code,
    status: problemFixture.status,
    detail: problemFixture.detail,
    recovery: problemFixture.recovery,
  };
  const screen = await render(<ProblemNotice problem={problem} onRetry={onRetry} />);

  await screen.getByRole("button", { name: "Retry" }).click();
  expect(onRetry).toHaveBeenCalledOnce();
});

test("blocks unhandled API requests with method and URL evidence", async () => {
  const response = await fetch("/api/testing/unhandled-contract");
  const evidence = await response.text();

  expect(response.status).toBe(500);
  expect(evidence).toContain("GET");
  expect(evidence).toContain("/api/testing/unhandled-contract");
});
