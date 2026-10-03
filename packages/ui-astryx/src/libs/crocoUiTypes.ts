import type { FrontendRecoveryAction } from "@croco/frontend-react";
import type { ProblemDetails } from "@croco/problems-core";

export type AstryxRecoveryAction = FrontendRecoveryAction;

export type AstryxProblemRecoveryAction = Omit<FrontendRecoveryAction, "onRecover"> & {
  readonly onRecover?: (problem: ProblemDetails) => void | Promise<void>;
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
