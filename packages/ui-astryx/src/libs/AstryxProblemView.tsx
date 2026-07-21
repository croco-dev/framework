import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import * as React from "react";

import type { ProblemDetails } from "@croco/problems-core";
import * as React from "react";

import type { AstryxProblemRecoveryAction } from "./crocoUiTypes";

export type AstryxProblemViewProps = {
  readonly problem: ProblemDetails;
  readonly recoveryActions?: readonly AstryxProblemRecoveryAction[];
};

function problemStatus(status: number): "error" | "info" | "warning" {
  if (status >= 500) {
    return "error";
  }

  if (status >= 400) {
    return "warning";
  }

  return "info";
}

function appliesToProblem(action: AstryxProblemRecoveryAction, problem: ProblemDetails): boolean {
  return action.problemCodes === undefined || action.problemCodes.includes(problem.code);
}

function recoveryButton(action: AstryxProblemRecoveryAction, problem: ProblemDetails) {
  const recover = action.onRecover;
  const clickAction = recover === undefined ? undefined : () => recover(problem);

  return (
    <Button
      aria-label={action.ariaLabel}
      clickAction={clickAction}
      href={action.href}
      isDisabled={action.disabled}
      key={action.id}
      label={action.label}
      variant="secondary"
    />
  );
}

export function AstryxProblemView({ problem, recoveryActions = [] }: AstryxProblemViewProps) {
  const visibleActions = recoveryActions.filter((action) => appliesToProblem(action, problem));
  const endContent =
    visibleActions.length === 0
      ? undefined
      : visibleActions.map((action) => recoveryButton(action, problem));

  return (
    <Banner
      container="card"
      data-croco-problem-code={problem.code}
      defaultIsExpanded
      description={problem.detail}
      endContent={endContent}
      status={problemStatus(problem.status)}
      title={problem.title}
    >
      <dl>
        <dt>Status</dt>
        <dd>{problem.status}</dd>
        <dt>Code</dt>
        <dd>{problem.code}</dd>
        <dt>Type</dt>
        <dd>{problem.type}</dd>
        {problem.instance === undefined ? null : (
          <>
            <dt>Instance</dt>
            <dd>{problem.instance}</dd>
          </>
        )}
      </dl>
    </Banner>
  );
}
