import { useEffect, useState } from "react";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { ProblemNotice } from "../ProblemNotice";
import { request } from "../api/client";
import { toFrontendProblem } from "../api/useUsers";
import { PROBLEM_FIXTURE } from "../test/server";
import type { FrontendProblem } from "../ProblemNotice";

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
  await expect.element(screen.getByText(PROBLEM_FIXTURE.code)).toBeVisible();
  await expect.element(screen.getByText(String(PROBLEM_FIXTURE.status))).toBeVisible();
  await expect.element(screen.getByText(PROBLEM_FIXTURE.detail)).toBeVisible();
  await expect.element(screen.getByText(PROBLEM_FIXTURE.recovery)).toBeVisible();
});

test("exposes a user interaction helper for recovery", async () => {
  const onRetry = vi.fn();
  const problem = {
    code: PROBLEM_FIXTURE.code,
    status: PROBLEM_FIXTURE.status,
    detail: PROBLEM_FIXTURE.detail,
    recovery: PROBLEM_FIXTURE.recovery,
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
