import { createElement as h, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import type { RewardAdminAccess } from "@croco/admin-core";
import type {
  PublishedRewardPolicy,
  RewardPolicy,
  RewardPublication,
} from "@croco/gamification-core";

export type RewardConsoleProps = {
  readonly state?:
    | { readonly kind: "loading" }
    | { readonly kind: "empty" }
    | {
        readonly kind: "denied" | "error" | "partial";
        readonly message: string;
        readonly reload?: () => void;
      };
  readonly access: RewardAdminAccess;
  readonly publication: PublishedRewardPolicy;
  readonly onPublish: (input: RewardPublication) => Promise<PublishedRewardPolicy>;
};

export function RewardConsole({
  access,
  publication,
  onPublish,
  state,
}: RewardConsoleProps): ReactElement {
  const [policy, setPolicy] = useState<RewardPolicy>(publication.policy);
  const [current, setCurrent] = useState(publication);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const synchronized = useRef(publication);
  useEffect(() => {
    const previous = synchronized.current;
    if (
      previous.scope.appId === publication.scope.appId &&
      previous.scope.environmentId === publication.scope.environmentId &&
      previous.scope.tenantId === publication.scope.tenantId &&
      previous.policy.id === publication.policy.id &&
      previous.revision === publication.revision
    )
      return;
    synchronized.current = publication;
    setCurrent(publication);
    setPolicy(publication.policy);
  }, [publication]);
  const [failed, setFailed] = useState(false);
  const total = policy.weights?.reduce((sum, weight) => sum + weight, 0) ?? 0;
  const publish = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setFailed(false);
    try {
      const intent = {
        scope: access.scope,
        actorId: access.actorId,
        policy,
        expectedRevision: current.revision,
        reason,
      };
      const fingerprint = JSON.stringify(intent);
      if (attempt.current?.fingerprint !== fingerprint)
        attempt.current = { fingerprint, key: crypto.randomUUID() };
      const result = await onPublish({ ...intent, idempotencyKey: attempt.current.key });
      synchronized.current = result;
      setCurrent(result);
      setPolicy(result.policy);
      setMessage(`Published revision ${result.revision}`);
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Publication failed");
    } finally {
      setPending(false);
    }
  };
  if (state && state.kind !== "partial")
    return h(
      "section",
      { "aria-label": "Reward policy console", "aria-busy": state.kind === "loading" },
      state.kind === "loading"
        ? h("p", { role: "status" }, "Loading reward policy…")
        : state.kind === "empty"
          ? h("p", null, "No published reward policy.")
          : h(
              "div",
              { role: "alert" },
              state.message,
              state.reload
                ? h("button", { type: "button", onClick: state.reload }, "Reload policy")
                : null,
            ),
    );
  return h(
    "section",
    { "aria-label": "Reward policy console" },
    h("h2", null, "Reward policy"),
    state?.kind === "partial" ? h("p", { role: "status" }, state.message) : null,
    h(
      "p",
      null,
      `${access.scope.appId} / ${access.scope.environmentId} / ${access.scope.tenantId}`,
    ),
    h(
      "p",
      null,
      `Revision ${current.revision} · Published by ${current.actorId} · ${current.reason}`,
    ),
    h(
      "form",
      { onSubmit: publish, "aria-busy": pending },
      h(
        "fieldset",
        {
          disabled:
            pending || state?.kind === "partial" || !access.permissions.includes("reward.publish"),
        },
        h("legend", null, "Publish policy"),
        h(
          "label",
          null,
          "Policy version",
          h("input", {
            required: true,
            value: policy.version,
            onChange: (e: { target: { value: string } }) =>
              setPolicy({ ...policy, version: e.target.value }),
          }),
        ),
        h(
          "label",
          null,
          h("input", {
            type: "checkbox",
            checked: policy.mode === "weighted",
            onChange: (e: { target: { checked: boolean } }) =>
              setPolicy({
                ...policy,
                mode: e.target.checked ? "weighted" : "fixed",
                weightedEnabled: e.target.checked,
                rewardEntries: e.target.checked
                  ? policy.rewardEntries
                  : policy.rewardEntries.slice(0, 1),
                weights: e.target.checked ? policy.rewardEntries.map(() => 1) : undefined,
              }),
          }),
          "Enable weighted rewards",
        ),
        h(
          "p",
          null,
          policy.mode === "fixed"
            ? "Fixed reward: every eligible achievement receives the first entry."
            : "Weighted rewards: one server selection per confirmed achievement.",
        ),
        policy.mode === "weighted"
          ? h(
              "button",
              {
                type: "button",
                onClick: () =>
                  setPolicy({
                    ...policy,
                    rewardEntries: [
                      ...policy.rewardEntries,
                      {
                        id: `reward-${policy.rewardEntries.length + 1}`,
                        kind: "badge",
                        badgeId: "",
                        title: "",
                      },
                    ],
                    weights: [...(policy.weights ?? []), 1],
                  }),
              },
              "Add reward entry",
            )
          : null,
        ...policy.rewardEntries.map((entry, index) =>
          h(
            "div",
            { key: index },
            h(
              "label",
              null,
              "Reward title",
              h("input", {
                required: true,
                value: entry.title,
                onChange: (e: { target: { value: string } }) =>
                  setPolicy({
                    ...policy,
                    rewardEntries: policy.rewardEntries.map((item, i) =>
                      i === index ? { ...item, title: e.target.value } : item,
                    ),
                  }),
              }),
            ),
            h(
              "label",
              null,
              "Reward kind",
              h(
                "select",
                {
                  value: entry.kind,
                  onChange: (e: { target: { value: string } }) =>
                    setPolicy({
                      ...policy,
                      rewardEntries: policy.rewardEntries.map((item, i) =>
                        i !== index
                          ? item
                          : e.target.value === "points"
                            ? {
                                id: item.id,
                                title: item.title,
                                kind: "points",
                                unit: "achievement-point",
                                amount: 1,
                              }
                            : { id: item.id, title: item.title, kind: "badge", badgeId: "" },
                      ),
                    }),
                },
                h("option", { value: "points" }, "Points"),
                h("option", { value: "badge" }, "Badge"),
              ),
            ),
            entry.kind === "badge"
              ? h(
                  "label",
                  null,
                  "Badge identity",
                  h("input", {
                    required: true,
                    value: entry.badgeId,
                    onChange: (e: { target: { value: string } }) =>
                      setPolicy({
                        ...policy,
                        rewardEntries: policy.rewardEntries.map((item, i) =>
                          i === index ? { ...entry, badgeId: e.target.value } : item,
                        ),
                      }),
                  }),
                )
              : h(
                  "label",
                  null,
                  "Point amount",
                  h("input", {
                    type: "number",
                    min: 1,
                    step: 1,
                    required: true,
                    value: entry.amount,
                    onChange: (e: { target: { value: string } }) =>
                      setPolicy({
                        ...policy,
                        rewardEntries: policy.rewardEntries.map((item, i) =>
                          i === index ? { ...entry, amount: Number(e.target.value) } : item,
                        ),
                      }),
                  }),
                ),
            h(
              "p",
              null,
              `${entry.title} · ${entry.kind}${entry.kind === "points" ? ` · ${entry.amount} achievement points` : ""}`,
            ),
            policy.mode === "weighted"
              ? h(
                  "label",
                  null,
                  `Integer weight for ${entry.title}`,
                  h("input", {
                    type: "number",
                    required: true,
                    min: 0,
                    step: 1,
                    value: policy.weights?.[index] ?? 1,
                    onChange: (e: { target: { value: string } }) =>
                      setPolicy({
                        ...policy,
                        weights: policy.rewardEntries.map((_, i) =>
                          i === index ? Number(e.target.value) : (policy.weights?.[i] ?? 1),
                        ),
                      }),
                  }),
                  h(
                    "span",
                    null,
                    ` ${total > 0 ? (((policy.weights?.[index] ?? 0) / total) * 100).toFixed(2) : "0"}%`,
                  ),
                )
              : null,
          ),
        ),
        h(
          "label",
          null,
          "Grant cap",
          h("input", {
            type: "number",
            min: 0,
            step: 1,
            required: true,
            value: policy.cap,
            onChange: (e: { target: { value: string } }) =>
              setPolicy({ ...policy, cap: Number(e.target.value) }),
          }),
        ),
        h("p", null, `Budget unit: ${policy.budgetUnit}`),
        h(
          "p",
          null,
          policy.fallback.kind === "no-reward"
            ? "When depleted: no reward"
            : `When depleted: ${policy.fallback.entry.title}, cap ${policy.fallback.cap}`,
        ),
        ...(["effectiveFrom", "effectiveUntil"] as const).map((field) =>
          h(
            "label",
            { key: field },
            field === "effectiveFrom" ? "Effective from (ISO)" : "Effective until (ISO)",
            h("input", {
              required: true,
              value: policy[field],
              onChange: (e: { target: { value: string } }) =>
                setPolicy({ ...policy, [field]: e.target.value }),
            }),
          ),
        ),
        h(
          "label",
          null,
          "Publication reason",
          h("input", {
            required: true,
            value: reason,
            onChange: (e: { target: { value: string } }) => setReason(e.target.value),
          }),
        ),
        h(
          "button",
          { type: "submit", disabled: !reason.trim() },
          pending ? "Publishing…" : "Publish policy",
        ),
      ),
    ),
    message ? h("p", { role: failed ? "alert" : "status" }, message) : null,
  );
}
