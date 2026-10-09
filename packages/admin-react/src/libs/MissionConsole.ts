import { createElement as h, useRef, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import type { MissionDefinition, MissionPublication } from "@croco/gamification-core";
import type { MissionConsoleAccess, MissionConsoleState } from "@croco/admin-core";

export type MissionConsoleProps = Readonly<{
  access: MissionConsoleAccess;
  state: MissionConsoleState;
  registeredActions: readonly string[];
  onPublish(publication: MissionPublication): Promise<MissionPublication>;
}>;

export function MissionConsole(props: MissionConsoleProps): ReactElement {
  const state = props.state;
  switch (state.kind) {
    case "loading":
      return h("section", { "aria-busy": true }, "Loading mission policy…");
    case "empty":
      return h("section", null, "No mission policy published");
    case "denied":
    case "error":
      return h("section", { role: "alert" }, state.message);
    case "partial":
    case "ready":
      return h(MissionEditor, {
        ...props,
        publication: state.publication,
        key: JSON.stringify([
          props.access.scope,
          props.access.actorId,
          state.publication.definition.id,
          state.publication.definition.version,
          state.publication.revision,
        ]),
      });
  }
}

function MissionEditor(
  props: MissionConsoleProps & { publication: MissionPublication },
): ReactElement {
  const [draft, setDraft] = useState<MissionDefinition>({
    ...props.publication.definition,
    version: props.publication.definition.version + 1,
  });
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string }>();
  const intent = useRef<{ signature: string; publication: MissionPublication } | undefined>(
    undefined,
  );
  const busy = useRef(false);
  function field(
    label: string,
    value: string | number,
    update: (value: string) => void,
    options?: readonly string[],
  ): ReactElement {
    return h(
      "label",
      null,
      label,
      options
        ? h(
            "select",
            {
              value,
              onChange: (event: ChangeEvent<HTMLSelectElement>) => update(event.target.value),
            },
            ...options.map((option) => h("option", { key: option, value: option }, option)),
          )
        : h("input", {
            type: typeof value === "number" ? "number" : "text",
            value,
            onChange: (event: ChangeEvent<HTMLInputElement>) => update(event.target.value),
          }),
    );
  }
  const update = (values: Partial<MissionDefinition>) =>
    setDraft((current) => ({ ...current, ...values }));
  async function publish(): Promise<void> {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setFeedback(undefined);
    const signature = JSON.stringify([draft, reason]);
    if (intent.current?.signature !== signature)
      intent.current = {
        signature,
        publication: {
          scope: props.access.scope,
          definition: draft,
          actorId: props.access.actorId,
          reason,
          revision: props.publication.revision + 1,
          idempotencyKey: crypto.randomUUID(),
          publishedAt: new Date().toISOString(),
        },
      };
    try {
      const published = await props.onPublish(intent.current.publication);
      setFeedback({
        error: false,
        message: `Published version ${published.definition.version}. Existing episodes retain their policy.`,
      });
    } catch (error) {
      setFeedback({
        error: true,
        message: error instanceof Error ? error.message : "Publication failed",
      });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return h(
    "section",
    { "aria-label": "Mission console" },
    h("h2", null, "Mission console"),
    props.state.kind === "partial"
      ? h("p", { role: "status" }, props.state.message ?? "Some policy data is unavailable")
      : null,
    h(
      "p",
      null,
      `Published version ${props.publication.definition.version} · revision ${props.publication.revision}`,
    ),
    h("p", null, "Publish a new version for a new episode. Past progress stays unchanged."),
    h(
      "fieldset",
      { disabled: pending || !props.access.permissions.includes("mission.publish") },
      h("legend", null, "New policy version"),
      field("Action", draft.actionId, (actionId) => update({ actionId }), props.registeredActions),
      field(
        "Period",
        draft.period,
        (period) => update({ period: period as MissionDefinition["period"] }),
        ["day", "week"],
      ),
      field(
        "Count mode",
        draft.countMode,
        (countMode) =>
          update({
            countMode: countMode as MissionDefinition["countMode"],
            unit: countMode === "events" ? "event" : "day",
          }),
        ["events", "distinct-days", "streak"],
      ),
      field("Target", draft.target, (value) => update({ target: Number(value) })),
      field("Period cap", draft.perPeriodCap, (value) => update({ perPeriodCap: Number(value) })),
      field("Time zone", draft.timezone, (timezone) => update({ timezone })),
      field("Publication reason", reason, setReason),
      h(
        "button",
        {
          type: "button",
          disabled: !reason.trim() || props.registeredActions.length === 0,
          onClick: publish,
        },
        pending ? "Publishing…" : "Publish new version",
      ),
    ),
    feedback ? h("p", { role: feedback.error ? "alert" : "status" }, feedback.message) : null,
  );
}
