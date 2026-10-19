import { useEffect, useRef, useState } from "react";
import type { ClassificationLabel, EnrichmentPage } from "@croco/analytics-core/enrichment";

export type EnrichmentConsoleState =
  | { readonly status: "loading" | "empty" | "denied" | "error"; readonly message?: string }
  | { readonly status: "ready" | "partial"; readonly page: EnrichmentPage };
export type EnrichmentConsoleCommand = {
  readonly reason: string;
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
};
export type EnrichmentReviewConsoleProps = {
  /** Change with authenticated app/environment/tenant or permission revision. */
  readonly scopeKey: string;
  readonly state: EnrichmentConsoleState;
  readonly definitions: readonly {
    readonly version: string;
    readonly labels: readonly ClassificationLabel[];
  }[];
  readonly canReview: boolean;
  readonly canClassify: boolean;
  readonly canExport: boolean;
  readonly onClassify: (itemId: string, version: string) => Promise<EnrichmentPage>;
  readonly onReview: (
    input: EnrichmentConsoleCommand & {
      itemId: string;
      version: string;
      labelId: string;
      evidence: string;
    },
  ) => Promise<EnrichmentPage>;
  readonly onExport: (input: EnrichmentConsoleCommand & { version: string }) => Promise<unknown>;
  readonly onRetry: (
    input: EnrichmentConsoleCommand & {
      itemId: string;
      receiptId: string;
      acknowledgeDuplicateBilling: boolean;
    },
  ) => Promise<EnrichmentPage>;
  readonly onLoad: (offset: number) => Promise<EnrichmentPage>;
  readonly onSettle: () => Promise<EnrichmentPage>;
};

/** Presentation only. Every callback must invoke the authorized server operations. */
export function EnrichmentReviewConsole(props: EnrichmentReviewConsoleProps) {
  // A permission/scope epoch remount prevents old source text and pending responses resurfacing.
  return (
    <Console
      key={JSON.stringify([
        props.scopeKey,
        "page" in props.state ? props.state.page.runId : props.state.status,
      ])}
      {...props}
    />
  );
}
function Console(props: EnrichmentReviewConsoleProps) {
  const [page, setPage] = useState<EnrichmentPage | null>(
    "page" in props.state ? props.state.page : null,
  );
  const [version, setVersion] = useState(props.definitions[0]?.version ?? "");
  const [reason, setReason] = useState("");
  const [acknowledge, setAcknowledge] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [exported, setExported] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const alive = useRef(true);
  const epoch = useRef(0);
  const commandKeys = useRef(new Map<string, string>());
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    epoch.current++;
    setPage("page" in props.state ? props.state.page : null);
    setExported(null);
    setError("");
    setBusy(false);
    setOffset(0);
  }, [props.state]);
  const definition = props.definitions.find((entry) => entry.version === version);
  function command(payload: unknown): EnrichmentConsoleCommand {
    const fingerprint = JSON.stringify([page?.revision, reason, payload]);
    const key = commandKeys.current.get(fingerprint) ?? crypto.randomUUID();
    commandKeys.current.set(fingerprint, key);
    return { reason, expectedRevision: page?.revision ?? -1, idempotencyKey: key };
  }
  async function perform(operation: () => Promise<EnrichmentPage | void>, loadedOffset?: number) {
    const current = ++epoch.current;
    setBusy(true);
    setError("");
    setExported(null);
    try {
      let result = await operation();
      if (!alive.current || current !== epoch.current) return;
      // Mutation responses use the server's first page. Keep the operator on the page
      // containing the item they acted on, with a fresh authorized bounded read.
      if (result && loadedOffset === undefined && offset !== 0) result = await props.onLoad(offset);
      if (alive.current && current === epoch.current && result) {
        setPage(result);
        if (loadedOffset !== undefined) setOffset(loadedOffset);
      }
    } catch {
      if (alive.current && current === epoch.current)
        setError(
          "Operation failed. Reload current state before changing a conflicting revision; retrying an unchanged command keeps its key.",
        );
    } finally {
      if (alive.current && current === epoch.current) setBusy(false);
    }
  }
  if (!page || !("page" in props.state))
    return (
      <section aria-label="Enrichment review">
        <h2>Enrichment review</h2>
        <p role={props.state.status === "error" ? "alert" : "status"}>
          {props.state.status === "loading"
            ? "Loading classification results…"
            : props.state.status === "denied"
              ? "Access denied."
              : props.state.status === "empty"
                ? "No batch selected."
                : "Results unavailable."}
        </p>
      </section>
    );
  return (
    <section aria-label="Enrichment review" style={{ maxWidth: "100%", overflowWrap: "anywhere" }}>
      <h2>Enrichment review</h2>
      <p>
        Run {page.runId} · Revision {page.revision} · {page.status}
      </p>
      <p>
        {page.requests} model requests · {page.reservedTokens} reserved tokens. Reservations are not
        measured usage. Candidates require human review before export.
      </p>
      <label>
        Definition version{" "}
        <select
          value={version}
          disabled={busy}
          onChange={(event) => {
            setVersion(event.target.value);
            setExported(null);
          }}
        >
          {props.definitions.map((entry) => (
            <option key={entry.version} value={entry.version}>
              {entry.version}
            </option>
          ))}
        </select>
      </label>{" "}
      <label>
        Audit reason{" "}
        <input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
      </label>
      <p>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void perform(() => props.onLoad(offset), offset);
          }}
        >
          Reload
        </button>{" "}
        <button
          type="button"
          disabled={busy || !props.canClassify}
          onClick={() => {
            void perform(props.onSettle);
          }}
        >
          Retry event and usage delivery
        </button>
      </p>
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Operation in progress…</p>}
      <p>
        <label>
          <input
            type="checkbox"
            checked={acknowledge}
            onChange={(event) => setAcknowledge(event.target.checked)}
          />{" "}
          I acknowledge that retrying an accepted or uncertain provider call can incur duplicate
          billing. Confirm the old worker has stopped before retry.
        </label>
      </p>
      {page.items.map((item) => (
        <article
          key={`${item.itemId}:${item.inputRevision}`}
          style={{ borderTop: "1px solid #ccc", paddingBlock: 12 }}
        >
          <h3>
            {item.itemId} · {item.inputRevision}
          </h3>
          <p>
            Source {item.sourceRef} · {item.availability}
          </p>
          <pre style={{ whiteSpace: "pre-wrap" }}>{item.original ?? "Original unavailable"}</pre>
          <button
            type="button"
            disabled={busy || !props.canClassify || item.availability !== "available"}
            onClick={() => {
              void perform(() => props.onClassify(item.itemId, version));
            }}
          >
            Classify with {version}
          </button>
          {!item.candidates.length && <p>No classification candidate.</p>}
          {item.candidates.map((candidate) => (
            <div key={candidate.receiptId}>
              <p>
                {candidate.definitionVersion} · {candidate.method} · {candidate.state} · Candidate:{" "}
                {candidate.labelId ?? "none"} ·{" "}
                {candidate.reason ??
                  (candidate.state === "running" ? "awaiting worker" : "complete")}{" "}
                · Attempt {candidate.attempt}
              </p>
              <p>
                Model {candidate.modelRef} · Normalization {candidate.normalizationVersion} ·
                Catalog {candidate.catalogHash} · Prompt {candidate.promptHash}
              </p>
              <p>
                Usage:{" "}
                {candidate.usage.kind === "unknown"
                  ? "unknown"
                  : `${candidate.usage.kind}: ${candidate.usage.inputTokens} input / ${candidate.usage.outputTokens} output tokens`}{" "}
                · Delivery {candidate.delivery}
              </p>
              {(candidate.state === "failed" || candidate.state === "running") && (
                <button
                  type="button"
                  disabled={
                    busy ||
                    !props.canClassify ||
                    !reason.trim() ||
                    candidate.retryAuthorized ||
                    ((candidate.state === "running" || candidate.reason === "acceptance-unknown") &&
                      !acknowledge)
                  }
                  onClick={() => {
                    void perform(() =>
                      props.onRetry({
                        ...command(["retry", candidate.receiptId, acknowledge]),
                        itemId: item.itemId,
                        receiptId: candidate.receiptId,
                        acknowledgeDuplicateBilling: acknowledge,
                      }),
                    );
                  }}
                >
                  {candidate.state === "running"
                    ? "Acknowledge stopped worker"
                    : "Authorize bounded retry"}
                </button>
              )}
              {(candidate.state === "failed" || candidate.state === "running") && (
                <p>
                  Provider calls are not retried automatically. Acceptance may be unknown; an
                  authorized server retry requires an audit reason and acknowledgement of possible
                  duplicate billing.
                  {candidate.state === "running" &&
                    " The server rejects acknowledgement until the worker lease expires. Reload after expiry; confirm the worker has stopped before acknowledging."}
                  {(candidate.state === "running" || candidate.reason === "acceptance-unknown") &&
                    " After confirming the old worker stopped, acknowledgement releases its slot even when the attempt limit prevents another call."}
                </p>
              )}
            </div>
          ))}
          <p>
            {item.review
              ? `Reviewed label: ${item.review.labelId} by ${item.review.actor}. Evidence: ${item.review.evidence}. Latest candidate ${item.candidates.at(-1)?.labelId === item.review.labelId ? "agrees with review" : "differs from review or is unknown"}.`
              : "Not reviewed. Export is blocked."}
          </p>
          {item.reviewHistory.length > 0 && (
            <details>
              <summary>Human review history (latest 20)</summary>
              {item.reviewHistory.map((review) => (
                <p key={review.revision}>
                  Revision {review.revision} ({review.definitionVersion}): {review.labelId} by{" "}
                  {review.actor} · {review.reason} · {review.evidence}
                </p>
              ))}
            </details>
          )}
          {definition && (
            <ReviewEditor
              key={`${item.itemId}:${version}:${item.review?.revision ?? 0}`}
              labels={definition.labels}
              initialLabel={item.review?.labelId}
              disabled={
                busy ||
                !props.canReview ||
                !reason.trim() ||
                (item.original === null &&
                  !item.candidates.some((candidate) => candidate.definitionVersion === version)) ||
                item.candidates.some(
                  (candidate) =>
                    candidate.definitionVersion === version && candidate.state === "running",
                ) ||
                item.availability === "deleted" ||
                item.availability === "result-expired"
              }
              onReview={(labelId, evidence) =>
                perform(() =>
                  props.onReview({
                    ...command([item.itemId, version, labelId, evidence]),
                    itemId: item.itemId,
                    version,
                    labelId,
                    evidence,
                  }),
                )
              }
            />
          )}
        </article>
      ))}
      {offset > 0 && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void perform(() => props.onLoad(0), 0);
          }}
        >
          First page
        </button>
      )}{" "}
      {page.nextOffset !== null && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const nextOffset = page.nextOffset ?? 0;
            void perform(() => props.onLoad(nextOffset), nextOffset);
          }}
        >
          Next page
        </button>
      )}
      <p>
        <button
          type="button"
          disabled={busy || !props.canExport || page.status !== "reviewed" || !reason.trim()}
          onClick={() => {
            void perform(async () => {
              const current = epoch.current;
              const result = await props.onExport({ ...command(["export", version]), version });
              const refreshed = await props.onLoad(offset);
              if (alive.current && current === epoch.current)
                setExported(JSON.stringify(result, null, 2));
              return refreshed;
            }, offset);
          }}
        >
          Export reviewed labels
        </button>
      </p>
      {exported && (
        <pre aria-label="Exported reviewed labels" style={{ whiteSpace: "pre-wrap" }}>
          {exported}
        </pre>
      )}
    </section>
  );
}
function ReviewEditor(props: {
  labels: readonly ClassificationLabel[];
  initialLabel?: string;
  disabled: boolean;
  onReview: (labelId: string, evidence: string) => Promise<void>;
}) {
  const [label, setLabel] = useState(
    props.labels.find((entry) => entry.id === props.initialLabel)?.id ?? props.labels[0]?.id ?? "",
  );
  const [evidence, setEvidence] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!props.disabled && evidence.trim()) void props.onReview(label, evidence);
      }}
    >
      <label>
        Reviewed label{" "}
        <select
          value={label}
          disabled={props.disabled}
          onChange={(event) => setLabel(event.target.value)}
        >
          {props.labels.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>{" "}
      <label>
        Review evidence{" "}
        <input
          value={evidence}
          maxLength={1000}
          required
          disabled={props.disabled}
          onChange={(event) => setEvidence(event.target.value)}
        />
      </label>{" "}
      <button type="submit" disabled={props.disabled || !evidence.trim()}>
        Approve label
      </button>
    </form>
  );
}
