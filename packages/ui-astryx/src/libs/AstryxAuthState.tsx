import type { BadgeVariant } from "@astryxdesign/core/Badge";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";

import type { ProblemDetails } from "@croco/problems-core";

import type { AstryxRecoveryAction, AstryxSession, AstryxSessionState } from "./crocoUiTypes";

export type AstryxAuthStateKind = "loading" | "signed-in" | "signed-out" | "unavailable";

type AstryxAuthStateBaseProps = {
  readonly detail?: string;
  readonly recoveryActions?: readonly AstryxRecoveryAction[];
};

export type AstryxAuthStateProps = AstryxAuthStateBaseProps &
  (
    | {
        readonly problem?: never;
        readonly session?: never;
        readonly state: "loading";
      }
    | {
        readonly problem?: never;
        readonly session: AstryxSession;
        readonly state: "signed-in";
      }
    | {
        readonly problem?: ProblemDetails;
        readonly session?: never;
        readonly state: "signed-out";
      }
    | {
        readonly problem: ProblemDetails;
        readonly session?: never;
        readonly state: "unavailable";
      }
  );

function stateBadge(state: AstryxAuthStateKind): {
  readonly label: string;
  readonly variant: BadgeVariant;
} {
  switch (state) {
    case "loading":
      return { label: "Loading", variant: "info" };
    case "signed-in":
      return { label: "Signed in", variant: "success" };
    case "signed-out":
      return { label: "Signed out", variant: "warning" };
    case "unavailable":
      return { label: "Unavailable", variant: "error" };
  }
}

function defaultDetail(state: AstryxAuthStateKind, session?: AstryxSession): string {
  switch (state) {
    case "loading":
      return "Checking your session.";
    case "signed-in":
      return (
        session?.user.label ??
        session?.user.email ??
        session?.user.userId ??
        "Authenticated session"
      );
    case "signed-out":
      return "Sign in to continue.";
    case "unavailable":
      return "The session provider is unavailable.";
  }
}

function actionButton(action: AstryxRecoveryAction) {
  const recover = action.onRecover;
  const clickAction = recover === undefined ? undefined : () => recover();

  return (
    <Button
      clickAction={clickAction}
      href={action.href}
      key={action.id}
      label={action.label}
      variant="secondary"
    />
  );
}

export function AstryxAuthState({
  detail,
  problem,
  recoveryActions = [],
  session,
  state,
}: AstryxAuthStateProps) {
  const badge = stateBadge(state);

  return (
    <Card
      data-croco-auth-state={state}
      padding={4}
      variant={state === "unavailable" ? "red" : "default"}
    >
      <header>
        <h2>Session</h2>
        <Badge label={badge.label} variant={badge.variant} />
      </header>
      <p>{detail ?? problem?.detail ?? defaultDetail(state, session)}</p>
      {session?.provider === undefined ? null : <p>Provider: {session.provider}</p>}
      {problem === undefined ? null : <p>Problem: {problem.code}</p>}
      {recoveryActions.length === 0 ? null : <div>{recoveryActions.map(actionButton)}</div>}
    </Card>
  );
}

export function toAstryxAuthStateProps(state: AstryxSessionState): AstryxAuthStateProps {
  switch (state.kind) {
    case "loading":
      return {
        recoveryActions: state.recoveryActions,
        state: "loading",
      };
    case "authenticated":
      return {
        session: state.session,
        state: "signed-in",
      };
    case "unauthenticated":
      return {
        problem: state.problem,
        recoveryActions: state.recoveryActions,
        state: "signed-out",
      };
    case "unavailable":
      return {
        problem: state.problem,
        recoveryActions: state.recoveryActions,
        state: "unavailable",
      };
  }
}
