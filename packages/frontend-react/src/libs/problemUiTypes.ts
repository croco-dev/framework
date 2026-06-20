import type { ErrorInfo, ReactNode } from "react";

import type { ProblemDetails } from "@croco/problems-core";

export type ProblemRecoveryActionKind =
  | "retry"
  | "signIn"
  | "requestAccess"
  | "changeTenant"
  | "contactSupport"
  | "custom";

export type ProblemRecoveryAction = {
  readonly id: string;
  readonly label: string;
  readonly kind?: ProblemRecoveryActionKind;
  readonly href?: string;
  readonly onRecover?: (problem: ProblemDetails) => void | Promise<void>;
  readonly problemCodes?: readonly string[];
  readonly disabled?: boolean;
  readonly ariaLabel?: string;
};

export type ProblemPanelProps = {
  readonly problem: ProblemDetails;
  readonly recoveryActions?: readonly ProblemRecoveryAction[];
  readonly titleLevel?: 2 | 3 | 4 | 5 | 6;
  readonly renderProblem?: (problem: ProblemDetails) => ReactNode;
  readonly renderRecoveryAction?: (
    action: ProblemRecoveryAction,
    problem: ProblemDetails,
  ) => ReactNode;
};

export type ProblemRecoveryActionsProps = {
  readonly problem: ProblemDetails;
  readonly actions: readonly ProblemRecoveryAction[];
  readonly renderRecoveryAction?: (
    action: ProblemRecoveryAction,
    problem: ProblemDetails,
  ) => ReactNode;
};

export type ProblemBoundaryFallbackState = {
  readonly problem: ProblemDetails;
  readonly error: unknown;
  readonly reset: () => void;
};

export type ProblemBoundaryFallback =
  | ReactNode
  | ((state: ProblemBoundaryFallbackState) => ReactNode);

export type ProblemBoundaryProps = {
  readonly children?: ReactNode;
  readonly fallback?: ProblemBoundaryFallback;
  readonly recoveryActions?: readonly ProblemRecoveryAction[];
  readonly onProblem?: (problem: ProblemDetails, error: unknown, errorInfo?: ErrorInfo) => void;
  readonly onReset?: (problem: ProblemDetails) => void;
  readonly resetKeys?: readonly unknown[];
};

export type ProblemBoundaryState = {
  readonly problem?: ProblemDetails;
  readonly error?: unknown;
};

export type ProblemToastPayload = {
  readonly problem: ProblemDetails;
  readonly title: string;
  readonly description?: string;
  readonly code: string;
  readonly status: number;
  readonly recoveryActions: readonly ProblemRecoveryAction[];
};

export type ProblemToastAdapterProps = {
  readonly problem: ProblemDetails;
  readonly recoveryActions?: readonly ProblemRecoveryAction[];
  readonly children: (payload: ProblemToastPayload) => ReactNode;
};
