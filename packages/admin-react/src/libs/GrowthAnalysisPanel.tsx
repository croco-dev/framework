import * as React from "react";

import type {
  AnalysisAnswer,
  AnalysisOutcome,
  AnalysisPlan,
  AnalysisProposal,
} from "@croco/analytics-core";

export type GrowthAnalysisPanelProps = {
  readonly propose: (question: string, signal: AbortSignal) => Promise<AnalysisProposal>;
  readonly execute: (plan: AnalysisPlan, signal: AbortSignal) => Promise<AnalysisOutcome>;
};

type PanelState =
  | { readonly status: "empty" | "loading" | "executing" }
  | { readonly status: "error"; readonly message: string }
  | AnalysisProposal
  | AnalysisOutcome;

const messages = {
  partial:
    "Analysis evidence is incomplete. Check source coverage, then submit the question again.",
  stale: "Analysis evidence is stale. Refresh the source, then submit the question again.",
  denied: "Access to this analysis was denied. Request access from an administrator.",
  unavailable: "Analysis is unavailable. Submit the question again to retry.",
  "definition-changed":
    "The metric definition changed. Submit the question again and confirm the updated definition.",
  error: "Analysis could not be completed. Submit the question again to retry.",
} as const;

const proposalMessages: Record<
  Extract<AnalysisProposal, { status: "unavailable" }>["reason"],
  string
> = {
  unsupported:
    "This question is not supported by the registered analyses. Ask about a supported metric.",
  "no-definitions":
    "No analysis definitions are available. Register an analysis for an authorized metric before retrying.",
  "definitions-changed":
    "The available metric definitions changed. Submit the question again to review current definitions.",
  truncated: "The model response was truncated. Narrow the question and retry.",
  refused: "The model declined this question. Revise the question and retry.",
};

const errorMessages: Readonly<Record<string, string>> = {
  "analytics-core/analysis-invalid-registration":
    "Analysis registration is invalid. Correct the server registration before retrying.",
  "analytics-core/analysis-settlement-failed":
    "Model execution finished but usage recording failed. Recover the execution receipt before submitting another question.",
  "analytics-core/analysis-input-budget-exceeded":
    "The question exceeds the input budget. Shorten the question and retry.",
  "analytics-core/analysis-output-budget-exceeded":
    "The model response exceeds the output budget. Narrow the question and retry.",
  "analytics-core/analysis-concurrency-exceeded":
    "The analysis concurrency limit was reached. Retry after another analysis finishes.",
  "analytics-core/analysis-cancelled":
    "Analysis was cancelled or timed out. Submit the question again to retry.",
  "analytics-core/analysis-invalid-json":
    "The model returned invalid JSON. Submit the question again to retry.",
  "analytics-core/analysis-invalid-plan":
    "The model returned an invalid analysis plan. Submit the question again to retry.",
  "analytics-core/analysis-invalid-usage":
    "The model returned invalid usage information. Submit the question again to retry.",
  "analytics-core/analysis-question-blocked":
    "The question was blocked by the personal-data policy. Remove personal information and retry.",
  "analytics-core/analysis-provider-failed":
    "The analysis provider failed. Submit the question again to retry.",
  "metrics-core/window-budget-exceeded":
    "The requested time window exceeds the read budget. Ask for a shorter time window.",
  "metrics-core/concurrency-budget-exceeded":
    "The metric read concurrency limit was reached. Retry after another read finishes.",
  "metrics-core/read-cancelled":
    "The metric read was cancelled or timed out. Submit the question again to retry.",
};

function errorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    Object.hasOwn(errorMessages, error.code)
  ) {
    return errorMessages[error.code] ?? messages.error;
  }
  return messages.error;
}

function Definition({
  definition,
}: {
  readonly definition: AnalysisPlan["metricDefinition"];
}): React.ReactElement {
  return (
    <>
      <dt>Definition</dt>
      <dd>{definition.id}</dd>
      <dt>Definition version</dt>
      <dd>{definition.version}</dd>
      <dt>Definition hash</dt>
      <dd>{definition.hash}</dd>
      <dt>Unit</dt>
      <dd>{definition.unit}</dd>
      <dt>Population</dt>
      <dd>{definition.population}</dd>
    </>
  );
}

function References({
  label,
  values,
}: {
  readonly label: string;
  readonly values: readonly string[];
}): React.ReactElement {
  return (
    <section aria-label={label}>
      <h4>{label}</h4>
      {values.length === 0 ? (
        <p>None reported</p>
      ) : (
        <ul>
          {values.slice(0, 32).map((value, index) => (
            <li key={index}>{value}</li>
          ))}
        </ul>
      )}
      {values.length > 32 && <p role="alert">Only the first 32 references are displayed.</p>}
    </section>
  );
}

function Answer({
  answer,
  headingRef,
}: {
  readonly answer: AnalysisAnswer;
  readonly headingRef: React.RefObject<HTMLHeadingElement | null>;
}): React.ReactElement {
  return (
    <section aria-label="Analysis answer">
      <h3 ref={headingRef} tabIndex={-1}>
        Analysis answer
      </h3>
      <p role="status">
        {answer.availability === "missing"
          ? "Data is missing; no value has been inferred."
          : "Analysis complete"}
      </p>
      <dl>
        {answer.facts.slice(0, 32).map((fact, index) => (
          <div key={index}>
            <dt>{fact.label}</dt>
            <dd>{fact.value === null ? "Missing" : fact.value}</dd>
          </div>
        ))}
      </dl>
      {answer.facts.length > 32 && <p role="alert">Only the first 32 facts are displayed.</p>}
      <dl>
        <Definition definition={answer.metricDefinition} />
        <dt>Result population</dt>
        <dd>{answer.population}</dd>
        <dt>Window from</dt>
        <dd>{answer.window.from}</dd>
        <dt>Window to</dt>
        <dd>{answer.window.to}</dd>
        <dt>Source</dt>
        <dd>{answer.source}</dd>
        <dt>Numerator</dt>
        <dd>{answer.numerator ?? "Not reported"}</dd>
        <dt>Denominator</dt>
        <dd>{answer.denominator ?? "Not reported"}</dd>
      </dl>
      <References label="Source references" values={answer.sourceRefs} />
      <References label="Snapshot references" values={answer.snapshotRefs} />
      <References label="Limitations" values={answer.limitations} />
    </section>
  );
}

export function GrowthAnalysisPanel({
  propose,
  execute,
}: GrowthAnalysisPanelProps): React.ReactElement {
  const [question, setQuestion] = React.useState("");
  const [state, setState] = React.useState<PanelState>({ status: "empty" });
  const [selectedId, setSelectedId] = React.useState("");
  const operation = React.useRef<AbortController | null>(null);
  const id = React.useId();
  const resultHeading = React.useRef<HTMLHeadingElement | null>(null);
  React.useEffect(() => {
    if (state.status === "confirmation" || state.status === "ready") resultHeading.current?.focus();
  }, [state.status]);
  const busy = state.status === "loading" || state.status === "executing";

  React.useEffect(
    () => () => {
      operation.current?.abort();
      operation.current = null;
    },
    [],
  );

  function clear(): void {
    operation.current?.abort();
    operation.current = null;
    setSelectedId("");
    setState({ status: "empty" });
  }

  async function run(
    kind: "loading" | "executing",
    action: (signal: AbortSignal) => Promise<AnalysisProposal | AnalysisOutcome>,
  ): Promise<void> {
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setSelectedId("");
    setState({ status: kind });
    try {
      const result = await action(controller.signal);
      if (operation.current !== controller) return;
      if (result.status === "confirmation" && result.choices.length === 0) {
        setState({ status: "unavailable" });
      } else {
        setState(result);
      }
    } catch (error) {
      if (operation.current === controller)
        setState({ status: "error", message: errorMessage(error) });
    } finally {
      if (operation.current === controller) operation.current = null;
    }
  }

  return (
    <section aria-label="Growth analysis" data-state={state.status} aria-busy={busy}>
      <h2>Growth analysis</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && question.trim())
            void run("loading", (signal) => propose(question.trim(), signal));
        }}
      >
        <label htmlFor={`${id}-question`}>Analysis question</label>
        <textarea
          id={`${id}-question`}
          value={question}
          required
          maxLength={2000}
          disabled={busy}
          onChange={(event) => {
            setQuestion(event.currentTarget.value);
            clear();
          }}
        />
        <button type="submit" disabled={busy || !question.trim()}>
          Propose analysis
        </button>
      </form>
      {busy && (
        <>
          <p role="status">
            {state.status === "loading"
              ? "Preparing analysis choices…"
              : "Running confirmed analysis…"}
          </p>
          <button type="button" onClick={clear}>
            Cancel analysis
          </button>
        </>
      )}
      {state.status === "confirmation" && (
        <section aria-label="Confirm analysis">
          <h3 ref={resultHeading} tabIndex={-1}>
            Confirm analysis
          </h3>
          <p>
            Model usage:{" "}
            {state.usage.kind === "unknown"
              ? "Unknown"
              : `${state.usage.kind}: ${state.usage.inputTokens} input tokens, ${state.usage.outputTokens} output tokens`}
          </p>
          <fieldset>
            <legend>Choose a concrete metric definition</legend>
            {state.choices.slice(0, 32).map((choice) => (
              <div key={choice.id}>
                <label>
                  <input
                    type="radio"
                    name={`${id}-choice`}
                    value={choice.id}
                    checked={selectedId === choice.id}
                    onChange={() => setSelectedId(choice.id)}
                  />
                  {choice.label}
                </label>
                <dl>
                  <dt>Query</dt>
                  <dd>{choice.plan.queryId}</dd>
                  <dt>Query version</dt>
                  <dd>{choice.plan.version}</dd>
                  <dt>Parameters</dt>
                  <dd>
                    <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                      {JSON.stringify(choice.plan.parameters, null, 2)}
                    </pre>
                  </dd>
                  <Definition definition={choice.plan.metricDefinition} />
                  <dt>Window from</dt>
                  <dd>{choice.plan.window.from}</dd>
                  <dt>Window to</dt>
                  <dd>{choice.plan.window.to}</dd>
                </dl>
                <References label="Assumptions" values={choice.plan.assumptions} />
                <References
                  label="Definition sources"
                  values={choice.plan.metricDefinition.sourceRefs}
                />
              </div>
            ))}
          </fieldset>
          {state.choices.length > 32 && (
            <p role="alert">Only the first 32 choices are displayed.</p>
          )}
          <button
            type="button"
            disabled={!selectedId}
            onClick={() => {
              const choice = state.choices.find((candidate) => candidate.id === selectedId);
              if (choice) void run("executing", (signal) => execute(choice.plan, signal));
            }}
          >
            Confirm and run
          </button>
          <button type="button" onClick={clear}>
            Reject proposal
          </button>
        </section>
      )}
      {state.status === "ready" && <Answer answer={state.answer} headingRef={resultHeading} />}
      {state.status in messages && (
        <p role="alert">
          {state.status === "error"
            ? state.message
            : state.status === "unavailable" && "reason" in state
              ? proposalMessages[state.reason]
              : messages[state.status as keyof typeof messages]}
        </p>
      )}
    </section>
  );
}
