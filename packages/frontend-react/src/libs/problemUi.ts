import {
  Component,
  Fragment,
  createElement,
  isValidElement,
  type ErrorInfo,
  type ReactElement,
  type ReactNode,
} from "react";

import type { ProblemDetails } from "@croco/problems-core";

import type {
  ProblemBoundaryFallbackState,
  ProblemBoundaryProps,
  ProblemBoundaryState,
  ProblemPanelProps,
  ProblemRecoveryAction,
  ProblemRecoveryActionsProps,
  ProblemToastAdapterProps,
  ProblemToastPayload,
} from "./problemUiTypes";

const ABOUT_BLANK = "about:blank";

export function normalizeProblemDetails(value: unknown): ProblemDetails {
  const serialized = toSerializedProblemDetails(value);
  if (serialized) {
    return serialized;
  }

  if (value instanceof Error) {
    return {
      type: ABOUT_BLANK,
      title: "Unexpected error",
      status: 500,
      code: "frontend-react/unhandled-error",
      ...(value.message ? { detail: value.message } : {}),
      errorName: value.name,
    };
  }

  return {
    type: ABOUT_BLANK,
    title: "Unknown problem",
    status: 500,
    code: "frontend-react/unknown-problem",
    thrownType: getThrownType(value),
    ...getThrownDetail(value),
  };
}

export function ProblemPanel({
  problem,
  recoveryActions = [],
  renderProblem,
  renderRecoveryAction,
  titleLevel = 2,
}: ProblemPanelProps): ReactElement {
  const problemBody = renderProblem
    ? wrapNode(renderProblem(problem))
    : createDefaultProblemBody(problem, titleLevel);

  return createElement(
    "section",
    {
      "aria-live": "assertive",
      "data-problem-code": problem.code,
      "data-problem-status": problem.status,
      "data-testid": "croco-problem-panel",
      role: "alert",
    },
    problemBody,
    recoveryActions.length > 0
      ? createElement(ProblemRecoveryActions, {
          actions: recoveryActions,
          problem,
          renderRecoveryAction,
        })
      : null,
  );
}

export function ProblemRecoveryActions({
  actions,
  problem,
  renderRecoveryAction,
}: ProblemRecoveryActionsProps): ReactElement {
  return createElement(
    "ul",
    { "data-testid": "croco-problem-actions" },
    actions.map((action) =>
      createElement(
        "li",
        {
          "data-recovery-action-kind": action.kind,
          key: action.id,
        },
        renderRecoveryAction
          ? wrapNode(renderRecoveryAction(action, problem))
          : createDefaultRecoveryAction(action, problem),
      ),
    ),
  );
}

export class ProblemBoundary extends Component<ProblemBoundaryProps, ProblemBoundaryState> {
  public override state: ProblemBoundaryState = {};

  public static getDerivedStateFromError(error: unknown): ProblemBoundaryState {
    return {
      error,
      problem: normalizeProblemDetails(error),
    };
  }

  public override componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
    this.props.onProblem?.(normalizeProblemDetails(error), error, errorInfo);
  }

  public override componentDidUpdate(previousProps: ProblemBoundaryProps): void {
    if (this.state.problem && resetKeysChanged(previousProps.resetKeys, this.props.resetKeys)) {
      this.reset();
    }
  }

  public override render(): ReactNode {
    if (!this.state.problem) {
      return this.props.children;
    }

    const fallbackState: ProblemBoundaryFallbackState = {
      error: this.state.error,
      problem: this.state.problem,
      reset: this.reset,
    };
    const fallback = this.props.fallback;

    if (typeof fallback === "function") {
      return wrapNode(fallback(fallbackState));
    }

    if (fallback !== undefined && fallback !== null) {
      return wrapNode(fallback);
    }

    return createElement(ProblemPanel, {
      problem: this.state.problem,
      recoveryActions: this.props.recoveryActions,
    });
  }

  private readonly reset = (): void => {
    const problem = this.state.problem;

    this.setState({
      error: undefined,
      problem: undefined,
    });

    if (problem) {
      this.props.onReset?.(problem);
    }
  };
}

export function createProblemToastPayload(
  problem: ProblemDetails,
  recoveryActions: readonly ProblemRecoveryAction[] = [],
): ProblemToastPayload {
  return {
    code: problem.code,
    description: problem.detail,
    problem,
    recoveryActions,
    status: problem.status,
    title: problem.title,
  };
}

export function ProblemToastAdapter({
  children,
  problem,
  recoveryActions = [],
}: ProblemToastAdapterProps): ReactElement {
  return wrapNode(children(createProblemToastPayload(problem, recoveryActions)));
}

function createDefaultProblemBody(
  problem: ProblemDetails,
  titleLevel: 2 | 3 | 4 | 5 | 6,
): ReactElement {
  const Heading = `h${titleLevel}` as "h2" | "h3" | "h4" | "h5" | "h6";

  return createElement(
    Fragment,
    null,
    createElement(Heading, { "data-testid": "croco-problem-title" }, problem.title),
    problem.detail
      ? createElement("p", { "data-testid": "croco-problem-detail" }, problem.detail)
      : null,
    createElement(
      "dl",
      { "data-testid": "croco-problem-evidence" },
      createElement("dt", null, "Code"),
      createElement("dd", null, problem.code),
      createElement("dt", null, "Status"),
      createElement("dd", null, String(problem.status)),
      problem.instance ? createElement("dt", null, "Instance") : null,
      problem.instance ? createElement("dd", null, problem.instance) : null,
    ),
  );
}

function createDefaultRecoveryAction(
  action: ProblemRecoveryAction,
  problem: ProblemDetails,
): ReactElement {
  if (action.href) {
    return createElement(
      "a",
      {
        "aria-disabled": action.disabled ? true : undefined,
        "aria-label": action.ariaLabel,
        href: action.disabled ? undefined : action.href,
      },
      action.label,
    );
  }

  return createElement(
    "button",
    {
      "aria-label": action.ariaLabel,
      disabled: action.disabled,
      onClick: () => action.onRecover?.(problem),
      type: "button",
    },
    action.label,
  );
}

function toSerializedProblemDetails(value: unknown): ProblemDetails | undefined {
  if (hasProblemToJSON(value)) {
    try {
      const serialized = value.toJSON();

      if (isProblemDetails(serialized)) {
        return serialized;
      }
    } catch {
      return undefined;
    }
  }

  return isProblemDetails(value) ? value : undefined;
}

function hasProblemToJSON(value: unknown): value is { readonly toJSON: () => unknown } {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as { readonly toJSON?: unknown }).toJSON === "function",
  );
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.type === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.status === "number" &&
    typeof candidate.code === "string"
  );
}

function getThrownType(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}

function getThrownDetail(value: unknown): { readonly detail?: string } {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint" ||
    typeof value === "symbol"
  ) {
    return { detail: String(value) };
  }

  return {};
}

function resetKeysChanged(
  previousKeys: readonly unknown[] | undefined,
  nextKeys: readonly unknown[] | undefined,
): boolean {
  if (previousKeys === nextKeys) {
    return false;
  }

  if (!previousKeys || !nextKeys || previousKeys.length !== nextKeys.length) {
    return true;
  }

  return nextKeys.some((key, index) => !Object.is(key, previousKeys[index]));
}

function wrapNode(node: ReactNode): ReactElement {
  return isValidElement(node) ? node : createElement(Fragment, null, node);
}
