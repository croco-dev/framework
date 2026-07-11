import type { ProblemDetails } from "@croco/problems-core";

export type AstryxRecoveryAction = {
  readonly id: string;
  readonly label: string;
  readonly href?: string;
  readonly onRecover?: () => void | Promise<void>;
  readonly problemCodes?: readonly string[];
};

export type AstryxProblemRecoveryAction = {
  readonly id: string;
  readonly label: string;
  readonly href?: string;
  readonly onRecover?: (problem: ProblemDetails) => void | Promise<void>;
  readonly problemCodes?: readonly string[];
  readonly disabled?: boolean;
  readonly ariaLabel?: string;
};

export type AstryxSession = {
  readonly user: {
    readonly userId: string;
    readonly label?: string;
    readonly email?: string;
  };
  readonly provider?: string;
};

export type AstryxSessionState =
  | {
      readonly kind: "loading";
      readonly recoveryActions?: readonly AstryxRecoveryAction[];
    }
  | {
      readonly kind: "authenticated";
      readonly session: AstryxSession;
    }
  | {
      readonly kind: "unauthenticated";
      readonly problem?: ProblemDetails;
      readonly recoveryActions?: readonly AstryxRecoveryAction[];
    }
  | {
      readonly kind: "unavailable";
      readonly problem: ProblemDetails;
      readonly recoveryActions?: readonly AstryxRecoveryAction[];
    };
