import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  executeCreditOperationsAction,
  loadCreditOperations,
  type CreditOperationsAction,
  type CreditOperationsActionRequest,
  type CreditOperationsActionResult,
  type CreditOperationsSnapshot,
  type CreditOperationsState,
} from "@croco/admin-core";
import { CreditOperationsConsole } from "@croco/admin-react";

const grantedPermissions = [
  "credits:read",
  "credits:write",
  "credits:refund",
  "credits:release",
] as const;

export type CreditOperationsDemoProps = {
  readonly tenantId: string;
  readonly loadSnapshot: (tenantId: string) => Promise<CreditOperationsSnapshot>;
  readonly executeAction: (
    action: CreditOperationsAction,
    request: CreditOperationsActionRequest,
  ) => Promise<CreditOperationsActionResult>;
};

export function CreditOperationsDemo({
  tenantId,
  loadSnapshot,
  executeAction,
}: CreditOperationsDemoProps) {
  const [state, setState] = useState<CreditOperationsState>({
    kind: "loading",
    tenantId,
  });
  const [pendingAction, setPendingAction] = useState<CreditOperationsAction>();
  const [actorId, setActorId] = useState("generated-operator");
  const [reason, setReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [result, setResult] = useState<string>();

  const refresh = useCallback(async () => {
    setState({ kind: "loading", tenantId });
    setState(
      await loadCreditOperations({
        grantedPermissions,
        source: {
          requiredPermissions: ["credits:read"],
          load: async () => ({ kind: "ready", snapshot: await loadSnapshot(tenantId) }),
        },
        tenantId,
      }),
    );
  }, [loadSnapshot, tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function selectAction(action: CreditOperationsAction) {
    setPendingAction(action);
    setReason("");
    setIdempotencyKey("");
    setResult(undefined);
  }

  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      pendingAction === undefined ||
      actorId.trim() === "" ||
      reason.trim() === "" ||
      idempotencyKey.trim() === ""
    ) {
      return;
    }
    const request = createActionRequest(pendingAction, {
      actorId,
      idempotencyKey,
      reason,
    });
    const actionResult = await executeCreditOperationsAction({
      action: pendingAction,
      executor: { execute: () => executeAction(pendingAction, request) },
      grantedPermissions,
      request,
    });
    setResult(
      actionResult.kind === "succeeded"
        ? `Appended ${actionResult.transactionIds.join(", ")} at ledger position ${actionResult.ledgerPosition}.`
        : `${actionResult.problem.code}: ${actionResult.recovery}`,
    );
    setPendingAction(undefined);
    await refresh();
  }

  return (
    <section aria-label="Generated credit ledger example">
      <CreditOperationsConsole
        onAction={selectAction}
        onRefresh={() => void refresh()}
        state={state}
      />
      {pendingAction ? (
        <form aria-label={`Confirm ${pendingAction.kind}`} onSubmit={submitAction}>
          <h2>Confirm {pendingAction.kind}</h2>
          <label>
            Actor
            <input
              name="actorId"
              onChange={(event) => setActorId(event.currentTarget.value)}
              required
              value={actorId}
            />
          </label>
          <label>
            Audit reason
            <input
              name="reason"
              onChange={(event) => setReason(event.currentTarget.value)}
              required
              value={reason}
            />
          </label>
          <label>
            Idempotency key
            <input
              name="idempotencyKey"
              onChange={(event) => setIdempotencyKey(event.currentTarget.value)}
              required
              value={idempotencyKey}
            />
          </label>
          <p>Possible Problems: {pendingAction.possibleProblems.join(", ")}</p>
          <button type="submit">Append audited credit transaction</button>
        </form>
      ) : null}
      {result ? <output aria-live="polite">{result}</output> : null}
    </section>
  );
}

export function createActionRequest(
  action: CreditOperationsAction,
  evidence: {
    readonly actorId: string;
    readonly reason: string;
    readonly idempotencyKey: string;
  },
): CreditOperationsActionRequest {
  const common = {
    ...evidence,
    accountId: action.accountId,
    action: action.kind,
    expectedPosition: action.ledgerPosition,
    reference: {
      id: new URLSearchParams({
        actorId: evidence.actorId,
        idempotencyKey: evidence.idempotencyKey,
        reason: evidence.reason,
      }).toString(),
      type: "admin-credit-operation",
    },
    targetId: action.targetId,
    tenantId: action.tenantId,
  };
  switch (action.kind) {
    case "grant":
      return { ...common, input: { amount: "5", kind: "grant", source: "operator-grant" } };
    case "adjustment":
      return {
        ...common,
        input: {
          amount: "1",
          direction: "credit",
          kind: "adjustment",
          source: "operator-adjustment",
        },
      };
    case "refund":
      return {
        ...common,
        input: {
          amount: "1",
          consumptionTransactionId: action.targetId,
          kind: "refund",
        },
      };
    case "release-reservation":
      return {
        ...common,
        input: { kind: "release-reservation", reservationId: action.targetId },
      };
  }
}
