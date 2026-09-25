import {
  loadEventCatalog,
  validateEventCatalogPayload,
  type EventCatalogInput,
  type EventCatalogScope,
  type EventCatalogSource,
  type EventCatalogState,
  type EventCatalogPayloadValidationState,
} from "@croco/admin-core";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from "react";

export type EventCatalogPanelProps = EventCatalogScope & {
  readonly principalId: string;
  readonly grantedPermissions: readonly string[];
  /** Keep this reference stable across renders; replacing it starts a new catalog request. */
  readonly source: EventCatalogSource;
};

type CatalogViewState =
  | EventCatalogState
  | { readonly kind: "loading" }
  | { readonly kind: "load-error" };
type ValidationViewState =
  | EventCatalogPayloadValidationState
  | { readonly kind: "invalid-json" }
  | { readonly kind: "validation-error" }
  | { readonly kind: "validating" };

const CATALOG_PAGE_SIZE = 20;

export function EventCatalogPanel(props: EventCatalogPanelProps): ReactElement {
  const { principalId, grantedPermissions, source } = props;
  const scope: EventCatalogScope =
    props.kind === "tenant"
      ? {
          kind: "tenant",
          tenantId: props.tenantId,
          appId: props.appId,
          environment: props.environment,
        }
      : { kind: "app", appId: props.appId, environment: props.environment };
  const requestKey = JSON.stringify({
    ...scope,
    principalId,
    grantedPermissions,
  });
  const [catalogLoad, setCatalogLoad] = useState<{
    readonly key: string;
    readonly source: EventCatalogSource;
    readonly state: CatalogViewState;
  }>({ key: requestKey, source, state: { kind: "loading" } });
  const [selectedKey, setSelectedKey] = useState("");
  const [page, setPage] = useState(0);
  const [payloadText, setPayloadText] = useState("{}");
  const [validation, setValidation] = useState<ValidationViewState | null>(null);
  const validationRequest = useRef(0);
  const payloadFieldId = useId();

  useEffect(() => {
    const controller = new AbortController();
    const request = JSON.parse(requestKey) as EventCatalogScope &
      Pick<EventCatalogInput, "principalId" | "grantedPermissions">;
    validationRequest.current += 1;
    setCatalogLoad({ key: requestKey, source, state: { kind: "loading" } });
    setSelectedKey("");
    setPage(0);
    setPayloadText("{}");
    setValidation(null);
    void loadEventCatalog({ ...request, source, signal: controller.signal }).then(
      (state) => {
        if (!controller.signal.aborted) setCatalogLoad({ key: requestKey, source, state });
      },
      () => {
        if (!controller.signal.aborted)
          setCatalogLoad({ key: requestKey, source, state: { kind: "load-error" } });
      },
    );
    return () => {
      controller.abort();
      validationRequest.current += 1;
    };
  }, [requestKey, source]);

  const currentCatalog: CatalogViewState =
    catalogLoad.key === requestKey && catalogLoad.source === source
      ? catalogLoad.state
      : { kind: "loading" };
  const entries =
    currentCatalog.kind === "ready" || currentCatalog.kind === "partial"
      ? currentCatalog.entries
      : [];
  const pageCount = Math.ceil(entries.length / CATALOG_PAGE_SIZE);
  const visibleEntries = entries.slice(page * CATALOG_PAGE_SIZE, (page + 1) * CATALOG_PAGE_SIZE);
  const selected =
    entries.find(({ descriptor }) => `${descriptor.name}@${descriptor.version}` === selectedKey) ??
    visibleEntries[0] ??
    entries[0];

  async function testPayload(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selected) return;
    let payload: unknown;
    try {
      payload = JSON.parse(payloadText) as unknown;
    } catch {
      validationRequest.current += 1;
      setValidation({ kind: "invalid-json" });
      return;
    }
    const request = ++validationRequest.current;
    setValidation({ kind: "validating" });
    try {
      const result = await validateEventCatalogPayload({
        ...scope,
        principalId,
        grantedPermissions,
        source,
        name: selected.descriptor.name,
        version: selected.descriptor.version,
        payload,
      });
      if (request === validationRequest.current) setValidation(result);
    } catch {
      if (request === validationRequest.current) setValidation({ kind: "validation-error" });
    }
  }

  function selectEvent(key: string): void {
    validationRequest.current += 1;
    setSelectedKey(key);
    setPayloadText("{}");
    setValidation(null);
  }

  function changePage(nextPage: number): void {
    validationRequest.current += 1;
    setPage(nextPage);
    setPayloadText("{}");
    setValidation(null);
  }

  return (
    <section
      aria-label="Product event catalog"
      aria-busy={currentCatalog.kind === "loading"}
      data-state={currentCatalog.kind}
    >
      <h1>Product event catalog</h1>
      {currentCatalog.kind === "loading" && <p>Loading event catalog</p>}
      {currentCatalog.kind === "empty" && (
        <p>No product events are defined for this app and environment.</p>
      )}
      {currentCatalog.kind === "permission-denied" && (
        <p role="alert">You do not have permission to read this event catalog.</p>
      )}
      {currentCatalog.kind === "unsupported" && (
        <p role="status">The event catalog is not available for this app and environment.</p>
      )}
      {(currentCatalog.kind === "problem" || currentCatalog.kind === "load-error") && (
        <p role="alert">Could not load the event catalog. Retry by reloading the panel.</p>
      )}
      {currentCatalog.kind === "partial" && (
        <p role="alert">
          The event catalog is incomplete ({currentCatalog.problem.code}). Reload to retry.
        </p>
      )}
      {(currentCatalog.kind === "ready" || currentCatalog.kind === "partial") && selected && (
        <>
          <nav aria-label="Catalog events">
            <ul>
              {visibleEntries.map(({ descriptor }) => {
                const key = `${descriptor.name}@${descriptor.version}`;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      aria-current={
                        selected.descriptor.name === descriptor.name &&
                        selected.descriptor.version === descriptor.version
                          ? "true"
                          : undefined
                      }
                      onClick={() => selectEvent(key)}
                    >
                      {descriptor.name} ({descriptor.version})
                    </button>
                  </li>
                );
              })}
            </ul>
            {pageCount > 1 && (
              <div aria-label="Catalog pages">
                <button type="button" disabled={page === 0} onClick={() => changePage(page - 1)}>
                  Previous page
                </button>{" "}
                <span aria-live="polite">
                  Page {page + 1} of {pageCount}
                </span>{" "}
                <button
                  type="button"
                  disabled={page >= pageCount - 1}
                  onClick={() => changePage(page + 1)}
                >
                  Next page
                </button>
              </div>
            )}
          </nav>
          <section aria-label={`${selected.descriptor.name} event details`}>
            <h2>{selected.descriptor.name}</h2>
            <p>{selected.descriptor.description}</p>
            <dl>
              <dt>Version</dt>
              <dd>{selected.descriptor.version}</dd>
              <dt>Scope</dt>
              <dd>{selected.descriptor.scope}</dd>
              <dt>Subject</dt>
              <dd>{selected.descriptor.subjectKind}</dd>
              <dt>Occurrence</dt>
              <dd>{selected.descriptor.occurrence}</dd>
              <dt>Owner</dt>
              <dd>{selected.descriptor.owner}</dd>
              <dt>Source</dt>
              <dd>{selected.descriptor.sourceLocation}</dd>
            </dl>
            <h3>Properties</h3>
            {Object.entries(selected.descriptor.propertyDescriptions).length === 0 ? (
              <p>No property descriptions are defined.</p>
            ) : (
              <dl>
                {Object.entries(selected.descriptor.propertyDescriptions).map(
                  ([name, description]) => (
                    <div key={name}>
                      <dt>{name}</dt>
                      <dd>{description}</dd>
                    </div>
                  ),
                )}
              </dl>
            )}
            <h3>Validation schema</h3>
            <pre aria-label="Event JSON schema">
              {JSON.stringify(selected.descriptor.schema, null, 2)}
            </pre>
            {selected.observation.kind === "unobserved" ? (
              <p data-observation="unobserved">
                No receipts have been observed. Receipt count is unknown.
              </p>
            ) : (
              <div data-observation="observed">
                <p>Received: {selected.observation.receivedCount}</p>
                <p>
                  Last received:{" "}
                  {selected.observation.lastReceivedAt ??
                    (selected.observation.receivedCount === 0 ? "Never" : "Unknown")}
                </p>
                <p>
                  Recent validation failure codes:{" "}
                  {selected.observation.recentFailureCodes.length === 0
                    ? "None recorded"
                    : selected.observation.recentFailureCodes.join(", ")}
                </p>
              </div>
            )}
          </section>
          <form
            aria-label="Test event payload"
            onSubmit={(event) => {
              void testPayload(event);
            }}
          >
            <h3>Test payload</h3>
            <label htmlFor={payloadFieldId}>JSON payload</label>
            <textarea
              id={payloadFieldId}
              value={payloadText}
              onChange={(event) => {
                validationRequest.current += 1;
                setPayloadText(event.currentTarget.value);
                setValidation(null);
              }}
              rows={8}
              spellCheck={false}
            />
            <button type="submit" disabled={validation?.kind === "validating"}>
              Validate payload
            </button>
            <p>This test validates the payload without sending an event.</p>
            {validation && <ValidationResult state={validation} />}
          </form>
        </>
      )}
    </section>
  );
}

function ValidationResult({ state }: { readonly state: ValidationViewState }): ReactElement {
  switch (state.kind) {
    case "validating":
      return <p role="status">Validating payload</p>;
    case "invalid-json":
      return <p role="alert">Enter a valid JSON payload.</p>;
    case "validation-error":
      return <p role="alert">Could not validate the payload. Try again.</p>;
    case "valid":
      return <p role="status">Payload is valid. No event was sent.</p>;
    case "invalid":
      return <p role="alert">Payload is invalid ({state.problem.code}). No event was sent.</p>;
    case "not-found":
      return <p role="alert">This event version is no longer registered. Reload the catalog.</p>;
    case "permission-denied":
      return <p role="alert">You do not have permission to validate event payloads.</p>;
    case "unsupported":
      return <p role="alert">Payload validation is unavailable for this app and environment.</p>;
    case "problem":
      return <p role="alert">Could not validate the payload. Try again.</p>;
  }
}
