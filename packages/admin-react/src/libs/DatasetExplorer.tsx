import { useRef, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import type {
  WarehouseAudit,
  WarehouseDataset,
  WarehousePage,
} from "@croco/warehouse-core/runtime";

export type DatasetExplorerState =
  | { readonly kind: "loading" }
  | { readonly kind: "empty" }
  | { readonly kind: "denied" | "unavailable" }
  | {
      readonly kind: "ready";
      readonly dataset: WarehouseDataset;
      readonly sample: WarehousePage | null;
      readonly sampleLimit: number;
    };

export type DatasetExplorerAction = WarehouseAudit & {
  readonly actor: string;
  readonly snapshotId: string;
};

export type DatasetExplorerRepublishAction = WarehouseAudit & {
  readonly actor: string;
  readonly candidateId: string;
  readonly fence: number;
};

export type DatasetExplorerProps = {
  readonly state: DatasetExplorerState;
  readonly actor: string;
  /** Presentation hints only; callbacks must authenticate and authorize each server mutation. */
  readonly canRepublish: boolean;
  readonly canRemove: boolean;
  readonly onRepublish: (request: DatasetExplorerRepublishAction) => Promise<void>;
  readonly onRemove: (request: DatasetExplorerAction) => Promise<void>;
};

/** Displays the service's canonical descriptor and its bounded, published snapshot sample. */
export function DatasetExplorer(props: DatasetExplorerProps): ReactElement {
  const { state } = props;
  return (
    <section
      aria-label="Dataset Explorer"
      data-state={state.kind}
      aria-busy={state.kind === "loading"}
    >
      <h2>Dataset Explorer</h2>
      {state.kind === "loading" && <p role="status">Loading dataset…</p>}
      {state.kind === "empty" && <p role="status">No dataset is registered.</p>}
      {state.kind === "denied" && <p role="alert">Dataset access denied.</p>}
      {state.kind === "unavailable" && <p role="alert">Dataset unavailable. Reload to retry.</p>}
      {state.kind === "ready" && (
        <DatasetDetails
          {...props}
          state={state}
          key={`${state.dataset.descriptor.semanticHash}:${state.dataset.revision}:${props.actor}`}
        />
      )}
    </section>
  );
}

function DatasetDetails({
  state,
  actor,
  canRepublish,
  canRemove,
  onRepublish,
  onRemove,
}: DatasetExplorerProps & {
  readonly state: Extract<DatasetExplorerState, { kind: "ready" }>;
}): ReactElement {
  const { dataset, sample, sampleLimit } = state;
  const { descriptor, head } = dataset;
  const sealedCandidates = dataset.candidates.filter(
    (candidate) =>
      candidate.state === "sealed" &&
      candidate.expectedHead === (head?.id ?? null) &&
      candidate.fence === dataset.revision + 1 &&
      candidate.permissionEpoch === dataset.permissionEpoch &&
      candidate.privacyEpoch === dataset.privacyEpoch,
  );
  const [candidateId, setCandidateId] = useState(sealedCandidates[0]?.id ?? "");
  const selectedCandidate = sealedCandidates.find((candidate) => candidate.id === candidateId);
  const [reason, setReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [operation, setOperation] = useState<"republish" | "remove">(
    canRepublish && sealedCandidates.length > 0 ? "republish" : "remove",
  );
  const [result, setResult] = useState<"pending" | "success" | "failed" | null>(null);
  const pending = useRef(false);
  const columns = Object.entries(descriptor.columns);
  const sampleValid =
    sample !== null &&
    head !== null &&
    sample.snapshotId === head.id &&
    sample.permissionEpoch === dataset.permissionEpoch &&
    sample.privacyEpoch === dataset.privacyEpoch &&
    Number.isSafeInteger(sampleLimit) &&
    sampleLimit > 0 &&
    sampleLimit <= 100 &&
    sample.rows.length <= sampleLimit;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (
      pending.current ||
      !actor.trim() ||
      !reason.trim() ||
      !idempotencyKey.trim() ||
      !(operation === "republish" ? canRepublish && selectedCandidate : canRemove && head)
    )
      return;
    pending.current = true;
    setResult("pending");
    try {
      const audit = {
        actor,
        reason: reason.trim(),
        idempotencyKey: idempotencyKey.trim(),
        expectedRevision: dataset.revision,
      };
      if (operation === "republish" && selectedCandidate) {
        await onRepublish({
          ...audit,
          candidateId: selectedCandidate.id,
          fence: selectedCandidate.fence,
        });
      } else if (operation === "remove" && head) {
        await onRemove({ ...audit, snapshotId: head.id });
      }
      setResult("success");
    } catch {
      setResult("failed");
    } finally {
      pending.current = false;
    }
  }

  return (
    <div style={{ overflowWrap: "anywhere", maxWidth: "100%" }}>
      <h3>{descriptor.name}</h3>
      <p>{descriptor.description}</p>
      <p>
        Model version: {descriptor.version} · Revision: {dataset.revision}
      </p>
      <p>
        Grain: {descriptor.grain.description} ({descriptor.grain.key.join(", ")})
      </p>
      <p>Sources: {descriptor.sourceRefs?.join(", ") || "No source references declared"}</p>
      <h4>Columns</h4>
      <dl>
        {columns.map(([name, column]) => (
          <div key={name}>
            <dt>
              {name} ({column.type})
            </dt>
            <dd>
              {column.description} · {column.sensitivity ?? "internal"}
            </dd>
          </div>
        ))}
      </dl>
      <h4>Last publication</h4>
      {head ? (
        <>
          <p>
            Published snapshot: {head.id} · {head.createdAt}
          </p>
          <dl>
            <dt>Freshness observed</dt>
            <dd>{head.quality.freshness.observedAt}</dd>
            <dt>Newest event</dt>
            <dd>{head.quality.freshness.newestEventAt ?? "Unknown"}</dd>
            <dt>Temporal completeness</dt>
            <dd>{head.quality.temporalCompleteness}</dd>
            <dt>Population coverage</dt>
            <dd>{head.quality.populationCoverage}</dd>
            <dt>Validity</dt>
            <dd>{head.quality.validity}</dd>
            <dt>Reproducibility</dt>
            <dd>{head.quality.reproducibility}</dd>
          </dl>
          <ul>
            {head.quality.sourceCoverage.map((source, index) => (
              <li key={index}>
                {source.sourceRef}: {source.state} · {source.from} – {source.through} · Gaps:{" "}
                {source.gaps.length} · Late: {source.late ? "yes" : "no"}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p role="status">No published snapshot. Completed ingestion does not publish a dataset.</p>
      )}
      <h4>Candidates</h4>
      <ul>
        {dataset.candidates.map((candidate) => (
          <li key={candidate.id} data-candidate-state={candidate.state}>
            {candidate.id}: {candidate.state}
            {candidate.state === "failed" ? " — failed candidate; last publication preserved" : ""}
          </li>
        ))}
      </ul>
      <h4>Bounded sample</h4>
      {!head ? (
        <p>No published sample.</p>
      ) : !sampleValid ? (
        <p role="alert">
          Sample unavailable. Reload to obtain an authorized sample from the published snapshot.
        </p>
      ) : sample.rows.length === 0 ? (
        <p role="status">Published snapshot has no sample rows.</p>
      ) : (
        <>
          <p>
            Showing {sample.rows.length} of at most {sampleLimit} rows · Query exactness:{" "}
            {sample.exactness}
          </p>
          <div
            style={{ overflowX: "auto" }}
            tabIndex={0}
            role="region"
            aria-label="Published sample"
          >
            <table>
              <thead>
                <tr>
                  {columns.map(([name]) => (
                    <th scope="col" key={name}>
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sample.rows.map((row, index) => (
                  <tr key={index}>
                    {columns.map(([name, column]) => (
                      <td key={name}>
                        {column.sensitivity === "sensitive"
                          ? "Masked"
                          : Object.hasOwn(row, name)
                            ? row[name] === null
                              ? "null"
                              : String(row[name])
                            : "Not included"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sample.nextCursor && <p>Additional rows exist outside this bounded sample.</p>}
        </>
      )}
      {(canRepublish || canRemove) && (
        <form
          aria-label="Dataset operation"
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <fieldset disabled={result === "pending" || result === "success"}>
            <legend>Audited dataset operation</legend>
            <p>
              Actor: {actor} · Expected revision: {dataset.revision}
            </p>
            <label>
              Operation
              <select
                aria-label="Operation"
                value={operation}
                onChange={(event) =>
                  setOperation(event.currentTarget.value === "remove" ? "remove" : "republish")
                }
              >
                <option value="republish" disabled={!canRepublish || sealedCandidates.length === 0}>
                  Republish snapshot
                </option>
                <option value="remove" disabled={!canRemove || !head}>
                  Remove snapshot
                </option>
              </select>
            </label>
            {operation === "republish" && (
              <label>
                Sealed candidate
                <select
                  aria-label="Sealed candidate"
                  value={candidateId}
                  onChange={(event) => setCandidateId(event.currentTarget.value)}
                  disabled={sealedCandidates.length === 0}
                >
                  {sealedCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.id} · Fence {candidate.fence}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {canRepublish && sealedCandidates.length === 0 && (
              <p role="status">No sealed candidate is available for publication.</p>
            )}
            <label>
              Reason
              <input
                aria-label="Reason"
                required
                value={reason}
                onChange={(event) => setReason(event.currentTarget.value)}
              />
            </label>
            <label>
              Idempotency key
              <input
                aria-label="Idempotency key"
                required
                value={idempotencyKey}
                onChange={(event) => setIdempotencyKey(event.currentTarget.value)}
              />
            </label>
            <button
              type="submit"
              disabled={
                !actor.trim() ||
                !reason.trim() ||
                !idempotencyKey.trim() ||
                !(operation === "republish" ? canRepublish && selectedCandidate : canRemove && head)
              }
            >
              Apply operation
            </button>
          </fieldset>
        </form>
      )}
      {result === "pending" && <p role="status">Applying operation…</p>}
      {result === "success" && (
        <p role="status">Operation confirmed by server. Reload to read the current publication.</p>
      )}
      {result === "failed" && (
        <p role="alert">
          Operation failed. Reload the dataset to verify its revision and permissions before
          retrying.
        </p>
      )}
    </div>
  );
}
