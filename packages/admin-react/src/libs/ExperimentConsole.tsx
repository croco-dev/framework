import * as React from "react";
import type { ReactElement } from "react";
import type {
  ExperimentAdminCommand,
  ExperimentAdminConfiguration,
  ExperimentAdminConfigureCommand,
  ExperimentAdminSnapshot,
} from "@croco/admin-core";

export type ExperimentConsolePreview =
  | Readonly<{ status: "evaluated"; value: string | boolean | number; reason: string }>
  | Readonly<{ status: "unavailable" | "evaluation_failed" | "not_assigned"; reason: string }>;
export type ExperimentConsoleState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "error" | "denied"; message: string }>
  | Readonly<{ kind: "ready"; snapshot: ExperimentAdminSnapshot }>;
export type ExperimentConsoleProps = Readonly<{
  state: ExperimentConsoleState;
  onCommand(command: ExperimentAdminCommand): Promise<void>;
  onConfigure(command: ExperimentAdminConfigureCommand): Promise<void>;
  onPreview(sampleId: string): Promise<ExperimentConsolePreview>;
  onReload(): Promise<void>;
}>;

export function ExperimentConsole(props: ExperimentConsoleProps): ReactElement {
  if (props.state.kind === "loading")
    return (
      <section aria-label="Experiment console" aria-busy="true">
        <p role="status">Loading experiment</p>
      </section>
    );
  if (props.state.kind !== "ready")
    return <ExperimentFailure {...props} message={props.state.message} />;
  const snapshot = props.state.snapshot;
  return (
    <ExperimentEditor
      key={JSON.stringify([
        snapshot.target.experimentId,
        snapshot.target.experimentRevision,
        snapshot.target.scope.app,
        snapshot.target.scope.environment,
        snapshot.target.scope.tenantId,
      ])}
      {...props}
      snapshot={snapshot}
    />
  );
}

function ExperimentFailure(props: ExperimentConsoleProps & { message: string }): ReactElement {
  const [error, setError] = React.useState(props.message);
  const [busy, setBusy] = React.useState(false);
  return (
    <section aria-label="Experiment console" aria-busy={busy}>
      <h1>Experiment unavailable</h1>
      <p role="alert">{error}</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void props
            .onReload()
            .catch((cause: unknown) =>
              setError(cause instanceof Error ? cause.message : "Reload failed"),
            )
            .finally(() => setBusy(false));
        }}
      >
        Reload experiment
      </button>
    </section>
  );
}

function ExperimentEditor(
  props: ExperimentConsoleProps & { snapshot: ExperimentAdminSnapshot },
): ReactElement {
  const { snapshot } = props;
  const [reason, setReason] = React.useState("");
  const [sampleId, setSampleId] = React.useState(snapshot.samples[0]?.id ?? "");
  const [preview, setPreview] = React.useState<ExperimentConsolePreview>();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  // Preserve the key for uncertain network outcomes; a changed payload gets a new key.
  const [pending, setPending] = React.useState<{ fingerprint: string; key: string }>();
  async function run(work: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(undefined);
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Experiment operation failed");
    } finally {
      setBusy(false);
    }
  }
  async function command(action: ExperimentAdminCommand["action"]): Promise<void> {
    const fingerprint = JSON.stringify([action, reason, snapshot.version]);
    const key = pending?.fingerprint === fingerprint ? pending.key : crypto.randomUUID();
    setPending({ fingerprint, key });
    await run(async () => {
      await props.onCommand({
        ...snapshot.target,
        action,
        expectedRevision: snapshot.version,
        reason,
        idempotencyKey: key,
      });
      setPending(undefined);
      setPreview(undefined);
    });
  }
  return (
    <section
      aria-label="Experiment console"
      aria-busy={busy}
      style={{ minWidth: 0, overflowWrap: "anywhere" }}
    >
      <h1>Experiment {snapshot.definition.id}</h1>
      <p role="status">
        {busy
          ? "Operation in progress"
          : `Revision ${snapshot.definition.revision} · ${snapshot.state} · version ${snapshot.version}`}
      </p>
      <p>
        {snapshot.target.scope.app} / {snapshot.target.scope.environment} /{" "}
        {snapshot.target.scope.tenantId ?? "application scope"}
      </p>
      {error && <p role="alert">{error}</p>}
      <h2>Registered experiment</h2>
      <dl>
        <dt>Hypothesis</dt>
        <dd>{snapshot.definition.hypothesis}</dd>
        <dt>Objective and observation plan</dt>
        <dd>{snapshot.definition.observationPlan}</dd>
        <dt>Assignment unit</dt>
        <dd>
          {snapshot.definition.unit} · {snapshot.definition.loginPolicy}
        </dd>
        <dt>Allocation</dt>
        <dd>{snapshot.definition.allocation / 100}% of eligible subjects</dd>
        <dt>Eligibility</dt>
        <dd>{snapshot.definition.eligibility}</dd>
        <dt>Period</dt>
        <dd>
          {snapshot.definition.startsAt ?? "On start"} —{" "}
          {snapshot.definition.endsAt ?? "Until stopped"}
        </dd>
      </dl>
      <ul aria-label="Registered variants">
        {snapshot.definition.variants.map((variant) => (
          <li key={variant.id}>
            {variant.id}: {String(variant.value)} · {variant.weight / 100}%
          </li>
        ))}
      </ul>
      <label>
        Change reason{" "}
        <input
          disabled={busy}
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
          required
        />
      </label>
      <fieldset disabled={busy || !snapshot.canPreview}>
        <legend>Sample preview</legend>
        <label>
          Server-owned sample{" "}
          <select
            value={sampleId}
            onChange={(event) => {
              setSampleId(event.currentTarget.value);
              setPreview(undefined);
            }}
          >
            {snapshot.samples.map((sample) => (
              <option key={sample.id} value={sample.id}>
                {sample.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!sampleId}
          onClick={() => {
            void run(async () => {
              setPreview(undefined);
              setPreview(await props.onPreview(sampleId));
            });
          }}
        >
          Preview sample
        </button>
        <p>Preview does not save assignments, exposures, or state changes.</p>
        {preview && (
          <p
            role={
              preview.status === "evaluation_failed" || preview.status === "unavailable"
                ? "alert"
                : "status"
            }
          >
            Preview: {preview.status}
            {preview.status === "evaluated" ? ` · ${String(preview.value)}` : ""} · {preview.reason}
          </p>
        )}
      </fieldset>
      <fieldset disabled={busy || !snapshot.canOperate}>
        <legend>Run experiment</legend>
        <div>
          <button
            type="button"
            disabled={!reason.trim() || (snapshot.state !== "draft" && snapshot.state !== "paused")}
            onClick={() => {
              void command("start");
            }}
          >
            {snapshot.state === "paused" ? "Resume experiment" : "Start experiment"}
          </button>
          <button
            type="button"
            disabled={!reason.trim() || snapshot.state !== "running"}
            onClick={() => {
              void command("pause");
            }}
          >
            Pause experiment
          </button>
          <button
            type="button"
            disabled={!reason.trim() || snapshot.state === "stopped"}
            onClick={() => {
              void command("stop");
            }}
          >
            Stop experiment
          </button>
        </div>
        <p>
          Pause blocks new assignment and treatment admission. Already delivered treatments and
          their later exposure records remain valid.
        </p>
      </fieldset>
      <details>
        <summary>Configure a new revision</summary>
        <ExperimentConfiguration
          snapshot={snapshot}
          busy={busy}
          reason={reason}
          onConfigure={async (configuration) => {
            const fingerprint = JSON.stringify([configuration, reason, snapshot.version]);
            const key = pending?.fingerprint === fingerprint ? pending.key : crypto.randomUUID();
            setPending({ fingerprint, key });
            await run(async () => {
              await props.onConfigure({
                ...snapshot.target,
                configuration,
                expectedRevision: snapshot.version,
                reason,
                idempotencyKey: key,
              });
              setPending(undefined);
              setPreview(undefined);
            });
          }}
        />
      </details>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          void run(async () => {
            await props.onReload();
            setPreview(undefined);
          });
        }}
      >
        Reload experiment
      </button>
    </section>
  );
}

function ExperimentConfiguration(props: {
  snapshot: ExperimentAdminSnapshot;
  busy: boolean;
  reason: string;
  onConfigure(configuration: ExperimentAdminConfiguration): Promise<void>;
}): ReactElement {
  const { snapshot } = props;
  const [draft, setDraft] = React.useState<ExperimentAdminConfiguration>({
    ...snapshot.definition,
    revision: "",
  });
  const update = <K extends keyof ExperimentAdminConfiguration>(
    key: K,
    value: ExperimentAdminConfiguration[K],
  ): void => {
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const allocationValid =
    Number.isSafeInteger(draft.allocation) &&
    draft.allocation >= 0 &&
    draft.allocation <= 10000 &&
    draft.variants.every(
      (variant) => Number.isSafeInteger(variant.weight) && variant.weight >= 0,
    ) &&
    draft.variants.reduce((sum, variant) => sum + variant.weight, 0) === draft.allocation;
  const periodValid =
    !draft.startsAt || !draft.endsAt || Date.parse(draft.startsAt) < Date.parse(draft.endsAt);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void props.onConfigure(draft);
      }}
    >
      <fieldset disabled={props.busy || !snapshot.canConfigure}>
        <legend>Configure a new revision</legend>
        <p>
          Existing assignments stay on their original revision. A new revision starts as a draft.
        </p>
        <label>
          New revision{" "}
          <input
            required
            value={draft.revision}
            onChange={(event) => update("revision", event.currentTarget.value)}
          />
        </label>
        <label>
          Hypothesis{" "}
          <input
            required
            value={draft.hypothesis}
            onChange={(event) => update("hypothesis", event.currentTarget.value)}
          />
        </label>
        <label>
          Objective and observation plan{" "}
          <textarea
            required
            value={draft.observationPlan}
            onChange={(event) => update("observationPlan", event.currentTarget.value)}
          />
        </label>
        <label>
          Assignment unit{" "}
          <select
            value={draft.unit}
            onChange={(event) =>
              update("unit", event.currentTarget.value as ExperimentAdminConfiguration["unit"])
            }
          >
            <option value="user">User</option>
            <option value="tenant">Tenant</option>
            <option value="anonymous">Stable anonymous identity</option>
          </select>
        </label>
        <label>
          Login identity policy{" "}
          <select
            value={draft.loginPolicy}
            onChange={(event) =>
              update(
                "loginPolicy",
                event.currentTarget.value as ExperimentAdminConfiguration["loginPolicy"],
              )
            }
          >
            <option value="preserve-unit">Preserve assignment unit</option>
            <option value="switch-unit">Explicitly switch unit; no history merge</option>
          </select>
        </label>
        <label>
          Allocation (basis points, 100 = 1%){" "}
          <input
            type="number"
            required
            min={0}
            max={10000}
            step={1}
            value={Number.isNaN(draft.allocation) ? "" : draft.allocation}
            onChange={(event) => update("allocation", event.currentTarget.valueAsNumber)}
          />
        </label>
        {draft.variants.map((variant, index) => (
          <label key={variant.id}>
            {variant.id} weight (basis points){" "}
            <input
              type="number"
              required
              min={0}
              max={10000}
              step={1}
              value={Number.isNaN(variant.weight) ? "" : variant.weight}
              onChange={(event) => {
                const weight = event.currentTarget.valueAsNumber;
                update(
                  "variants",
                  draft.variants.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, weight } : entry,
                  ),
                );
              }}
            />
          </label>
        ))}
        {!allocationValid && (
          <p role="alert">Variant weights must add up to allocation (0–10000 basis points).</p>
        )}
        <label>
          Eligibility rule{" "}
          <select
            value={draft.eligibility}
            onChange={(event) => update("eligibility", event.currentTarget.value)}
          >
            {snapshot.eligibilityOptions.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Starts at (UTC){" "}
          <input
            type="datetime-local"
            value={draft.startsAt ? new Date(draft.startsAt).toISOString().replace(/Z$/, "") : ""}
            onChange={(event) =>
              update(
                "startsAt",
                event.currentTarget.value ? `${event.currentTarget.value}Z` : undefined,
              )
            }
          />
        </label>
        <label>
          Ends at (UTC){" "}
          <input
            type="datetime-local"
            value={draft.endsAt ? new Date(draft.endsAt).toISOString().replace(/Z$/, "") : ""}
            onChange={(event) =>
              update(
                "endsAt",
                event.currentTarget.value ? `${event.currentTarget.value}Z` : undefined,
              )
            }
          />
        </label>
        {!periodValid && <p role="alert">End time must follow start time.</p>}
        <button
          type="submit"
          disabled={
            !props.reason.trim() ||
            !draft.revision.trim() ||
            draft.revision === snapshot.definition.revision ||
            !allocationValid ||
            !periodValid
          }
        >
          Create draft revision
        </button>
      </fieldset>
    </form>
  );
}
