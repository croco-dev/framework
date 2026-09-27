import { createElement, type ErrorInfo, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ProblemDetails } from "@croco/problems-core";

import {
  ProblemBoundary,
  ProblemPanel,
  ProblemRecoveryActions,
  ProblemToastAdapter,
  createFrontendProblemDetails,
  createProblemToastPayload,
  normalizeProblemDetails,
  type ProblemBoundaryFallbackState,
  type ProblemBoundaryState,
  type ProblemRecoveryAction,
} from "../index";

const problem = createFrontendProblemDetails({
  code: "orders/not-found",
  detail: "Order ord_123 is no longer available.",
  source: "orders",
  status: 404,
  title: "Order not found",
});

class ClientProblemError extends Error {
  readonly problem: ProblemDetails;
  readonly response: Response;

  constructor(problem: ProblemDetails, response: Response) {
    super(problem.detail ?? problem.title);
    this.name = "ProblemClientError";
    this.problem = problem;
    this.response = response;
  }
}

describe("Problem UI primitives", () => {
  it("renders Problem Details evidence and recovery actions", () => {
    const html = renderToStaticMarkup(
      createElement(ProblemPanel, {
        problem,
        recoveryActions: [
          {
            href: "/orders",
            id: "retry-list",
            kind: "retry",
            label: "Retry from orders",
            problemCodes: ["orders/not-found"],
          },
        ],
      }),
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('data-problem-code="orders/not-found"');
    expect(html).toContain('data-problem-status="404"');
    expect(html).toContain("Order not found");
    expect(html).toContain("Order ord_123 is no longer available.");
    expect(html).toContain("orders/not-found");
    expect(html).toContain("404");
    expect(html).toContain("/orders");
  });

  it("keeps customized rendering typed to ProblemDetails", () => {
    let capturedCode: string | undefined;
    const html = renderToStaticMarkup(
      createElement(ProblemPanel, {
        problem,
        renderProblem: (details) => {
          capturedCode = details.code;

          return createElement("output", { "data-testid": "custom-problem" }, details.title);
        },
      }),
    );

    expect(capturedCode).toBe("orders/not-found");
    expect(html).toContain('data-testid="custom-problem"');
    expect(html).toContain("Order not found");
  });

  it("normalizes external Error values without losing diagnostic evidence", () => {
    const details = normalizeProblemDetails(new TypeError("network exploded"));

    expect(details.code).toBe("frontend-react/unhandled-error");
    expect(details.title).toBe("Unexpected error");
    expect(details.status).toBe(500);
    expect(details.detail).toBe("network exploded");
    expect(details.errorName).toBe("TypeError");
  });

  it("preserves a client Error's server Problem in the boundary state, callback, and fallback", () => {
    const forbidden: ProblemDetails = {
      type: "https://docs.example.com/problems/order-forbidden",
      title: "Forbidden",
      status: 403,
      code: "orders/forbidden",
      detail: "You cannot view order 42.",
      traceId: "trace-42",
    };
    const error = new ClientProblemError(forbidden, new Response(null, { status: 403 }));
    const onProblem = vi.fn();
    const fallback = vi.fn((state: ProblemBoundaryFallbackState) =>
      createElement("aside", null, `${state.problem.code}:${state.problem.traceId}`),
    );
    const boundary = new ProblemBoundary({ children: null, fallback, onProblem });

    expect(normalizeProblemDetails(error)).toEqual(forbidden);
    boundary.state = ProblemBoundary.getDerivedStateFromError(error);
    boundary.componentDidCatch(error, { componentStack: "" } as ErrorInfo);
    const html = renderToStaticMarkup(boundary.render() as ReactElement);

    expect(boundary.state.problem).toEqual(forbidden);
    expect(onProblem).toHaveBeenCalledWith(forbidden, error, expect.any(Object));
    expect(fallback).toHaveBeenCalledWith(expect.objectContaining({ error, problem: forbidden }));
    expect(html).toContain("orders/forbidden:trace-42");
  });

  it("keeps an Error with an invalid problem field on the unhandled-error path", () => {
    const error = Object.assign(new Error("network exploded"), {
      problem: { title: "Incomplete Problem", status: 403 },
    });

    expect(normalizeProblemDetails(error)).toEqual({
      type: "about:blank",
      title: "Unexpected error",
      status: 500,
      code: "frontend-react/unhandled-error",
      detail: "network exploded",
      errorName: "Error",
    });
  });

  it("normalizes Croco Problem objects through serialized Problem Details", () => {
    const details = normalizeProblemDetails({
      toJSON: () => ({
        ...problem,
        traceId: "trace-1",
      }),
    });

    expect(details.code).toBe("orders/not-found");
    expect(details.traceId).toBe("trace-1");
  });

  it("normalizes Problems with failing serialization as explicit unknown Problem Details", () => {
    const details = normalizeProblemDetails({
      toJSON: () => {
        throw new Error("serialization unavailable");
      },
    });

    expect(details.code).toBe("frontend-react/unknown-problem");
    expect(details.title).toBe("Unknown problem");
    expect(details.status).toBe(500);
    expect(details.thrownType).toBe("object");
  });

  it("normalizes unknown thrown values into explicit unknown Problem Details", () => {
    const details = normalizeProblemDetails({ reason: "opaque failure" });

    expect(details.code).toBe("frontend-react/unknown-problem");
    expect(details.title).toBe("Unknown problem");
    expect(details.status).toBe(500);
    expect(details.thrownType).toBe("object");
  });

  it("renders boundary fallback with the typed Problem model", () => {
    const boundary = new ProblemBoundary({
      children: createElement("span", null, "ready"),
      fallback: (state: ProblemBoundaryFallbackState) =>
        createElement("aside", { "data-testid": "boundary-fallback" }, state.problem.code),
    });
    boundary.state = ProblemBoundary.getDerivedStateFromError(problem) as ProblemBoundaryState;
    const html = renderToStaticMarkup(boundary.render() as ReactElement);

    expect(html).toContain('data-testid="boundary-fallback"');
    expect(html).toContain("orders/not-found");
  });

  it("passes the active problem to recovery action callbacks", async () => {
    let recoveredCode: string | undefined;
    const actions: readonly ProblemRecoveryAction[] = [
      {
        id: "retry",
        kind: "retry",
        label: "Retry",
        onRecover: async (details) => {
          recoveredCode = details.code;
        },
      },
    ];
    const actionsRegion = ProblemRecoveryActions({ actions, problem }) as ReactElement<{
      readonly children: readonly ReactElement<{ readonly children: ReactElement }>[];
    }>;
    const actionItem = actionsRegion.props.children[0];
    const button = actionItem.props.children as ReactElement<{
      readonly onClick: () => void | Promise<void>;
    }>;

    await button.props.onClick();

    expect(recoveredCode).toBe("orders/not-found");
  });

  it("adapts Problems to provider-neutral toast payloads", () => {
    const payload = createProblemToastPayload(problem, [
      { id: "support", kind: "contactSupport", label: "Contact support" },
    ]);
    const html = renderToStaticMarkup(
      createElement(ProblemToastAdapter, {
        children: (toast) =>
          createElement("span", { "data-testid": "toast-title" }, `${toast.title}:${toast.code}`),
        problem,
      }),
    );

    expect(payload.problem).toBe(problem);
    expect(payload.recoveryActions[0]?.kind).toBe("contactSupport");
    expect(html).toContain("Order not found:orders/not-found");
  });
});
