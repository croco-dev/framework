import { createElement as h, useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import type { GoalDefinition, GoalProgress, GoalSubject } from "@croco/onboarding-core";
import type {
  ActivationGuideAccess,
  ActivationGuidePreviewRequest,
  ActivationGuidePublished,
  ActivationGuidePublishRequest,
  ActivationGuideState,
} from "@croco/admin-core";

export type ActivationGuideTarget = Readonly<{
  label: string;
  subject: GoalSubject;
  episodeId: string;
}>;

export type ActivationGuideConsoleProps = Readonly<{
  access: ActivationGuideAccess;
  definition: GoalDefinition;
  state: ActivationGuideState;
  targets: readonly ActivationGuideTarget[];
  asOf: string;
  onPreview(request: ActivationGuidePreviewRequest): Promise<GoalProgress>;
  onPublish(request: ActivationGuidePublishRequest): Promise<ActivationGuidePublished>;
}>;

function field(
  label: string,
  value: string | number,
  update: (value: string) => void,
  type = "text",
): ReactElement {
  return h(
    "label",
    { style: { display: "grid", gap: "0.25rem", margin: "0.5rem 0" } },
    label,
    h("input", {
      "aria-label": label,
      type,
      value,
      style: { boxSizing: "border-box", maxWidth: "100%" },
      onChange: (event: ChangeEvent<HTMLInputElement>) => update(event.target.value),
    }),
  );
}

function select(
  label: string,
  value: string,
  options: readonly string[],
  update: (value: string) => void,
): ReactElement {
  return h(
    "label",
    { style: { display: "grid", gap: "0.25rem", margin: "0.5rem 0" } },
    label,
    h(
      "select",
      {
        "aria-label": label,
        value,
        style: { maxWidth: "100%" },
        onChange: (event: ChangeEvent<HTMLSelectElement>) => update(event.target.value),
      },
      options.map((option) => h("option", { key: option, value: option }, option)),
    ),
  );
}

function optionalText(value: string): string | undefined {
  return value.trim() === "" ? undefined : value;
}

export function ActivationGuideConsole(props: ActivationGuideConsoleProps): ReactElement {
  const identity = JSON.stringify([
    props.access.scope.tenantId,
    props.access.scope.appId,
    props.access.scope.environmentId,
    props.definition.id,
    props.definition.version,
  ]);
  const [draft, setDraft] = useState(props.definition);
  const [reason, setReason] = useState("");
  const [targetIndex, setTargetIndex] = useState(0);
  const [preview, setPreview] = useState<GoalProgress>();
  const [pending, setPending] = useState<"preview" | "publish" | null>(null);
  const [feedback, setFeedback] = useState("");
  const identityRef = useRef(identity);
  const previewRequestRef = useRef(0);
  const publicationRef = useRef<{ signature: string; key: string } | null>(null);
  identityRef.current = identity;

  useEffect(() => {
    setDraft(props.definition);
    setReason("");
    setTargetIndex(0);
    setPreview(undefined);
    setPending(null);
    setFeedback("");
  }, [identity]);

  const canPreview = props.access.permissions.includes("onboarding.goal.preview");
  const canPublish = props.access.permissions.includes("onboarding.goal.publish");
  const target = props.targets[targetIndex];
  const targetIdentity = target ? JSON.stringify([target.subject.id, target.episodeId]) : "";
  const targetIdentityRef = useRef(targetIdentity);
  targetIdentityRef.current = targetIdentity;
  const change = (update: Partial<GoalDefinition>) =>
    setDraft((current) => ({ ...current, ...update }));
  const updateStep = (
    index: number,
    update: Partial<NonNullable<GoalDefinition["guidanceSteps"]>[number]>,
  ) =>
    change({
      guidanceSteps: (draft.guidanceSteps ?? []).map((step, position) =>
        position === index ? { ...step, ...update } : step,
      ),
    });
  const previewTarget = async () => {
    if (!target) return;
    const requestIdentity = identity;
    const requestTargetIdentity = targetIdentity;
    const requestNumber = ++previewRequestRef.current;
    setPending("preview");
    setFeedback("");
    try {
      const request: ActivationGuidePreviewRequest = {
        scope: props.access.scope,
        subject: target.subject,
        episodeId: target.episodeId,
        asOf: props.asOf,
      };
      const result = await props.onPreview(request);
      if (
        identityRef.current === requestIdentity &&
        targetIdentityRef.current === requestTargetIdentity &&
        previewRequestRef.current === requestNumber
      )
        setPreview(result);
    } catch (error) {
      if (
        identityRef.current === requestIdentity &&
        targetIdentityRef.current === requestTargetIdentity &&
        previewRequestRef.current === requestNumber
      ) {
        setPreview(undefined);
        setFeedback(error instanceof Error ? error.message : "Preview failed");
      }
    } finally {
      if (identityRef.current === requestIdentity && previewRequestRef.current === requestNumber)
        setPending(null);
    }
  };
  const publish = async () => {
    const requestIdentity = identity;
    setPending("publish");
    setFeedback("");
    try {
      const intent = {
        scope: props.access.scope,
        definition: draft,
        actor: props.access.actor,
        reason,
        expectedRevision:
          props.state.kind === "ready" || props.state.kind === "partial"
            ? props.state.published.revision
            : 0,
      };
      const signature = JSON.stringify(intent);
      if (publicationRef.current?.signature !== signature) {
        publicationRef.current = { signature, key: crypto.randomUUID() };
      }
      const request: ActivationGuidePublishRequest = {
        ...intent,
        idempotencyKey: publicationRef.current.key,
      };
      const result = await props.onPublish(request);
      if (identityRef.current === requestIdentity) {
        publicationRef.current = null;
        setFeedback(`Published revision ${result.revision}`);
      }
    } catch (error) {
      if (identityRef.current === requestIdentity) {
        setFeedback(error instanceof Error ? error.message : "Publication failed");
      }
    } finally {
      if (identityRef.current === requestIdentity) setPending(null);
    }
  };

  if (props.state.kind === "loading")
    return h("section", { "aria-busy": true }, "Loading activation guide…");
  if (props.state.kind === "denied")
    return h("section", { role: "alert" }, `Access denied: ${props.state.code}`);
  if (props.state.kind === "error")
    return h("section", { role: "alert" }, `Guide unavailable: ${props.state.code}`);

  return h(
    "section",
    { "aria-label": "Activation guide" },
    h("h2", null, "Activation guide"),
    props.state.kind === "empty" ? h("p", null, "No published goal") : null,
    props.state.kind === "partial"
      ? h("p", { role: "status" }, props.state.message ?? "Some progress is unavailable")
      : null,
    field("Goal title", draft.title ?? "", (title) => change({ title: optionalText(title) })),
    field("Goal description", draft.description ?? "", (description) =>
      change({ description: optionalText(description) }),
    ),
    field("Action ID", draft.actionId, (actionId) => change({ actionId })),
    field("Definition version", draft.version, (version) => change({ version })),
    select("Anchor", draft.anchor, ["signup", "first_visit", "return"], (anchor) =>
      change({ anchor: anchor as GoalDefinition["anchor"] }),
    ),
    select(
      "Count mode",
      draft.countMode,
      ["events", "distinct_objects", "distinct_calendar_days"],
      (countMode) => change({ countMode: countMode as GoalDefinition["countMode"] }),
    ),
    field("Threshold", draft.threshold, (value) => change({ threshold: Number(value) }), "number"),
    field(
      "Window (milliseconds)",
      draft.windowMs,
      (value) => change({ windowMs: Number(value) }),
      "number",
    ),
    field(
      "Allowed lateness (milliseconds)",
      draft.allowedLatenessMs,
      (value) => change({ allowedLatenessMs: Number(value) }),
      "number",
    ),
    field("Time zone", draft.timezone, (timezone) => change({ timezone })),
    select(
      "Deleted object policy",
      draft.deletedObjectPolicy,
      ["retain", "retract"],
      (deletedObjectPolicy) =>
        change({
          deletedObjectPolicy: deletedObjectPolicy as GoalDefinition["deletedObjectPolicy"],
        }),
    ),
    field("Next action link", draft.nextActionHref ?? "", (nextActionHref) =>
      change({ nextActionHref: optionalText(nextActionHref) }),
    ),
    h(
      "fieldset",
      { style: { minWidth: 0 } },
      h("legend", null, "Step guidance"),
      ...(draft.guidanceSteps ?? []).map((step, index) =>
        h(
          "div",
          { key: step.id },
          field(`Step ${index + 1} title`, step.title, (title) => updateStep(index, { title })),
          field(`Step ${index + 1} description`, step.description ?? "", (description) =>
            updateStep(index, { description: optionalText(description) }),
          ),
          field(`Step ${index + 1} link`, step.href ?? "", (href) =>
            updateStep(index, { href: optionalText(href) }),
          ),
          h(
            "button",
            {
              type: "button",
              onClick: () =>
                change({
                  guidanceSteps: (draft.guidanceSteps ?? []).filter(
                    (_, position) => position !== index,
                  ),
                }),
            },
            `Remove step ${index + 1}`,
          ),
        ),
      ),
      h(
        "button",
        {
          type: "button",
          onClick: () =>
            change({
              guidanceSteps: [
                ...(draft.guidanceSteps ?? []),
                { id: crypto.randomUUID(), title: "New step" },
              ],
            }),
        },
        "Add step",
      ),
    ),
    h("h3", null, "Target preview"),
    props.targets.length > 0
      ? h(
          "label",
          null,
          "Target",
          h(
            "select",
            {
              "aria-label": "Target",
              value: String(targetIndex),
              onChange: (event: ChangeEvent<HTMLSelectElement>) => {
                previewRequestRef.current++;
                setTargetIndex(Number(event.target.value));
                setPreview(undefined);
                setPending((current) => (current === "preview" ? null : current));
              },
            },
            props.targets.map((entry, index) =>
              h("option", { key: entry.episodeId, value: String(index) }, entry.label),
            ),
          ),
        )
      : h("p", null, "No verified preview targets"),
    target ? h("p", null, target.label) : null,
    h(
      "button",
      {
        type: "button",
        disabled: !canPreview || !target || pending !== null,
        onClick: previewTarget,
      },
      "Preview",
    ),
    preview
      ? h(
          "p",
          { role: "status" },
          `${preview.progress} of ${preview.threshold} · ${preview.status}`,
        )
      : null,
    field("Publication reason", reason, setReason),
    h(
      "button",
      {
        type: "button",
        disabled: !canPublish || !reason.trim() || pending !== null,
        onClick: publish,
      },
      "Publish",
    ),
    feedback ? h("p", { role: "status" }, feedback) : null,
  );
}
