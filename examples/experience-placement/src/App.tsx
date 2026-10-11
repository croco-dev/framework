import { createElement as h, useState } from "react";
import { ExperienceConsole } from "@croco/admin-react/experience-console";
import { ExperienceSlot } from "@croco/frontend-react/experience-slot";
import type { ReactElement } from "react";
import type { ExperienceAdminPreview, ExperienceAdminState } from "@croco/admin-core";
import type {
  ExperienceConfig,
  ExperienceContent,
  ExposureHandle,
  PlacementDefinition,
  PlacementEvaluation,
} from "@croco/experience-core";

export type DemoBootstrap = Readonly<{
  config: ExperienceConfig;
  placement: PlacementDefinition;
  evaluation: PlacementEvaluation;
  adminState: ExperienceAdminState;
}>;

async function api<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const value = (await response.json()) as T & { code?: string; detail?: string };
  if (!response.ok)
    throw Object.assign(new Error(value.detail ?? "Request failed"), { code: value.code });
  return value;
}

function notice(content: ExperienceContent): ReactElement {
  return h(
    "div",
    { className: "notice" },
    h("strong", null, content.title),
    h("p", null, content.body),
    content.actionUrl ? h("a", { href: content.actionUrl }, "Learn more") : null,
  );
}
const renderers = { banner: notice, card: notice, modal: notice };

export function DemoApp({ initial }: { initial: DemoBootstrap }): ReactElement {
  const [config, setConfig] = useState(initial.config);
  const [evaluation, setEvaluation] = useState(initial.evaluation);
  const [status, setStatus] = useState(
    initial.evaluation.reason === "unavailable"
      ? "Experience storage unavailable. Checkout is still available; refresh after recovery."
      : "Waiting for a visible display",
  );
  const selected = evaluation.reason === "selected" ? evaluation : undefined;
  const refresh = async (): Promise<void> => {
    try {
      const next = await api<PlacementEvaluation>("/api/decision", {});
      setEvaluation(next);
      setStatus(
        next.reason === "selected" ? "Waiting for a visible display" : `Decision: ${next.reason}`,
      );
    } catch {
      setEvaluation({ reason: "unavailable", decision: null });
      setStatus(
        "Experience storage unavailable. Checkout is still available; refresh after recovery.",
      );
    }
  };

  return h(
    "main",
    null,
    h(
      "section",
      { className: "panel" },
      h("h1", null, "In-app experience"),
      h(
        "p",
        null,
        "Registered checkout.assurance placement · server decision · real PostgreSQL receipts",
      ),
      h(ExperienceConsole, {
        placement: initial.placement,
        config,
        state: initial.adminState,
        renderers,
        canPreview: true,
        canPublish: true,
        onPreview: (draft: ExperienceConfig) =>
          api<ExperienceAdminPreview>("/api/preview", { config: draft }),
        onSave: async (input) => {
          const saved = await api<ExperienceConfig>("/api/config", input);
          setConfig(saved);
          await refresh();
          return saved;
        },
      }),
    ),
    h(
      "section",
      { className: "panel", "aria-label": "Checkout example" },
      h("h2", null, "Checkout"),
      h(
        "div",
        { className: "checkout" },
        h("p", null, "Order total: $18.00"),
        h(ExperienceSlot, {
          decision: selected?.decision ?? null,
          handle: selected?.exposureHandle,
          renderers,
          onExposure: async (handle: ExposureHandle) => {
            const result = await api<{ result: string }>("/api/exposure", { handle });
            setStatus(`Display ${result.result}`);
          },
          onDismiss: async (handle: ExposureHandle) => {
            await api("/api/dismiss", { handle });
            setStatus("Dismissal saved");
          },
          onError: () => setStatus("Receipt failed; retry the visible action"),
        }),
        h("button", { type: "button", onClick: () => void refresh() }, "Refresh decision"),
        h("button", { type: "button" }, "Continue checkout"),
      ),
      h("p", { role: "status" }, status),
    ),
  );
}
