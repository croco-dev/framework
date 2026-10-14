import { createElement as h, useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { SurveyCard, SurveyModal } from "@croco/frontend-react/surveys";
import { SurveyEditor, SurveyPreview, SurveyResults } from "@croco/admin-react/surveys";
import { SurveyInvalidProblem } from "@croco/research-core";
import type {
  SurveyDefinition,
  SurveyResponse,
  SurveyPublication,
  SurveyAnswers,
} from "@croco/research-core";
import type { SurveyAdminAccess, SurveyPublishRequest } from "@croco/admin-core/survey-operations";
import type { SurveyResultsData, SurveyResultsState } from "@croco/admin-react/surveys";

async function api<T>(path: string, role: "customer" | "operator", input?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: input === undefined ? "GET" : "POST",
    headers: { "x-demo-role": role, "content-type": "application/json" },
    body: input === undefined ? undefined : JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new SurveyInvalidProblem(data.message ?? "Request failed");
  return data as T;
}
type Invitation = { token: string; invitationId: string; definition: SurveyDefinition };
function InvitedSurvey(props: {
  invitation: Invitation;
  modal: boolean;
  returnFocusTo?: HTMLElement;
  onClose: () => void;
  onExposed: () => Promise<void>;
  onSubmit: (answers: SurveyAnswers) => Promise<void>;
  onDismiss: () => Promise<void>;
}) {
  const [failure, setFailure] = useState("");
  const callbacks = useRef(props);
  callbacks.current = props;
  const token = props.invitation.token;
  const [receipt] = useState(() => {
    let resolve!: () => void;
    let reject!: (reason: unknown) => void;
    const ready = new Promise<void>((accept, decline) => {
      resolve = accept;
      reject = decline;
    });
    // A failed exposure is also reported when no submit or dismiss is waiting.
    void ready.catch(() => undefined);
    return { ready, resolve, reject };
  });
  useEffect(() => {
    let active = true;
    // This effect runs after the survey has mounted; an invitation alone is not an exposure.
    void api("/api/expose", "customer", { token }).then(
      () => {
        receipt.resolve();
        if (active) void callbacks.current.onExposed();
      },
      (error: unknown) => {
        receipt.reject(error);
        if (active) {
          setFailure("Survey unavailable. Your report is saved.");
          callbacks.current.returnFocusTo?.focus();
        }
      },
    );
    return () => {
      active = false;
    };
  }, [token, receipt]);
  if (failure) return h("p", { role: "alert" }, failure);
  return h(props.modal ? SurveyModal : SurveyCard, {
    definition: props.invitation.definition,
    identity: props.invitation.invitationId,
    returnFocusTo: props.returnFocusTo,
    onClose: props.onClose,
    onSubmit: async (answers) => {
      await receipt.ready;
      await props.onSubmit(answers);
    },
    onDismiss: async () => {
      await receipt.ready;
      await props.onDismiss();
    },
  });
}
function App() {
  const saveButton = useRef<HTMLButtonElement>(null);
  const [boot, setBoot] = useState<{ publication: SurveyPublication; access: SurveyAdminAccess }>();
  const [bootstrapError, setBootstrapError] = useState("");
  const [name, setName] = useState("First report");
  const [product, setProduct] = useState("");
  const [invitation, setInvitation] = useState<Invitation>();
  const [surveyMessage, setSurveyMessage] = useState("");
  const [modal, setModal] = useState(false);
  const [preview, setPreview] = useState(false);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<SurveyResultsState>({ kind: "loading" });
  const denominator = useRef<"invitation" | "exposure">("invitation");
  const [rows, setRows] = useState<readonly SurveyResponse[]>([]);
  const after = useRef("");
  const [fixture, setFixture] = useState("ready");
  const [csv, setCsv] = useState("");
  const refreshSequence = useRef(0);
  async function refresh(kind = denominator.current, cursor = after.current) {
    const sequence = ++refreshSequence.current;
    try {
      const [data, responses] = await Promise.all([
        api<SurveyResultsData>("/api/results", "operator", { denominator: kind }),
        api<readonly SurveyResponse[]>("/api/raw", "operator", { after: cursor }),
      ]);
      if (sequence !== refreshSequence.current) return;
      setRows(responses);
      setState({ kind: "ready", data, responses });
    } catch (e) {
      if (sequence !== refreshSequence.current) return;
      setState({ kind: "error", message: e instanceof Error ? e.message : "Results unavailable" });
    }
  }
  useEffect(() => {
    void api<{ publication: SurveyPublication; access: SurveyAdminAccess }>(
      "/api/bootstrap",
      "operator",
    )
      .then(setBoot)
      .catch((error: unknown) =>
        setBootstrapError(error instanceof Error ? error.message : "Survey editor unavailable"),
      );
    void refresh();
  }, []);
  const saveSequence = useRef(0);
  async function save() {
    const sequence = ++saveSequence.current;
    setPending(true);
    try {
      const result = await api<{ reportId: string }>("/api/report", "customer", { name });
      if (sequence !== saveSequence.current) return;
      setProduct(`Report saved: ${result.reportId}`);
      setInvitation(undefined);
      setSurveyMessage("");
      setPending(false);
      // The product acknowledgement arrives before any optional survey request.
      try {
        const candidate = await api<typeof invitation | null>("/api/invitation", "customer", {
          reportId: result.reportId,
        });
        if (sequence !== saveSequence.current) return;
        if (candidate) {
          setInvitation(candidate);
        }
      } catch {
        if (sequence === saveSequence.current)
          setSurveyMessage("Survey unavailable. Your report is saved.");
      }
      if (sequence === saveSequence.current) await refresh();
    } catch (e) {
      if (sequence === saveSequence.current)
        setProduct(e instanceof Error ? e.message : "Report save failed");
    } finally {
      if (sequence === saveSequence.current) setPending(false);
    }
  }
  async function change(
    r: SurveyResponse,
    reason: string,
    operation: "delete" | "classify",
    classification?: string,
  ) {
    await api("/api/change", "operator", {
      invitationId: r.invitationId,
      operation,
      classification,
      expectedRevision: r.revision,
      reason,
      idempotencyKey: crypto.randomUUID(),
    });
    await refresh();
  }
  const displayed: SurveyResultsState =
    fixture === "ready"
      ? state
      : fixture === "error"
        ? { kind: "error", message: "Demonstrated storage error; counts unavailable." }
        : fixture === "partial" && state.kind === "ready"
          ? { ...state, kind: "partial", message: "Demonstrated partial raw access." }
          : fixture === "loading" || fixture === "empty" || fixture === "denied"
            ? { kind: fixture }
            : state;
  return h(
    "main",
    null,
    h(
      "div",
      null,
      h(
        "section",
        { "aria-label": "Product report" },
        h("h2", null, "Save a report"),
        h(
          "label",
          null,
          "Report name",
          h("input", {
            "aria-label": "Report name",
            value: name,
            onChange: (e: { target: { value: string } }) => setName(e.target.value),
          }),
        ),
        h(
          "button",
          { ref: saveButton, disabled: pending, onClick: () => void save() },
          "Save report",
        ),
        h("p", { role: "status" }, product),
        h(
          "label",
          null,
          h("input", {
            type: "checkbox",
            checked: modal,
            onChange: (e: { target: { checked: boolean } }) => setModal(e.target.checked),
          }),
          "Use survey modal",
        ),
      ),
      invitation &&
        h(InvitedSurvey, {
          key: invitation.invitationId,
          invitation,
          modal,
          onExposed: () => refresh(),
          onClose: () =>
            setInvitation((current) =>
              current?.invitationId === invitation.invitationId ? undefined : current,
            ),
          returnFocusTo: saveButton.current ?? undefined,
          onSubmit: async (answers) => {
            await api("/api/submit", "customer", {
              token: invitation.token,
              answers,
              idempotencyKey: invitation.invitationId,
            });
            await refresh();
            setInvitation((current) =>
              current?.invitationId === invitation.invitationId ? undefined : current,
            );
            setSurveyMessage("Thank you for your response.");
          },
          onDismiss: async () => {
            await api("/api/dismiss", "customer", { token: invitation.token });
            await refresh();
            setInvitation((current) =>
              current?.invitationId === invitation.invitationId ? undefined : current,
            );
            setSurveyMessage("Survey skipped. Your product action is complete.");
          },
        }),
      h("p", { role: "status" }, surveyMessage),
      bootstrapError && h("p", { role: "alert" }, bootstrapError),
      boot &&
        h(SurveyEditor, {
          access: boot.access,
          definition: boot.publication.definition,
          revision: boot.publication.revision,
          onPublish: async (request: SurveyPublishRequest) => {
            const publication = await api<SurveyPublication>("/api/publish", "operator", request);
            setBoot({ ...boot, publication });
            await refresh();
          },
        }),
      h("button", { onClick: () => setPreview((v) => !v) }, "Toggle standalone preview"),
      preview && boot && h(SurveyPreview, { definition: boot.publication.definition }),
    ),
    h(
      "div",
      null,
      h(
        "label",
        null,
        "Demonstrate result state",
        h(
          "select",
          {
            "aria-label": "Demonstrate result state",
            value: fixture,
            onChange: (e: { target: { value: string } }) => setFixture(e.target.value),
          },
          ["ready", "loading", "empty", "partial", "denied", "error"].map((v) =>
            h("option", { key: v, value: v }, v),
          ),
        ),
      ),
      h(SurveyResults, {
        state: displayed,
        onDenominatorChange: (value) => {
          denominator.current = value;
          void refresh(value);
        },
        onDelete: (r, reason) => change(r, reason, "delete"),
        onClassify: (r, value, reason) => change(r, reason, "classify", value),
        onNextPage:
          rows.length === 20
            ? () => {
                const cursor = rows[rows.length - 1]?.id ?? "";
                after.current = cursor;
                void refresh(denominator.current, cursor);
              }
            : undefined,
      }),
      h(
        "button",
        {
          onClick: async () => {
            const result = await api<{ csv: string }>("/api/export", "operator", {});
            setCsv(result.csv);
          },
        },
        "Export first 100 responses",
      ),
      csv && h("pre", { "aria-label": "Escaped CSV" }, csv),
    ),
  );
}
const root = document.getElementById("root");
if (root) createRoot(root).render(h(App));
