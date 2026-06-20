import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

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
