import { createElement as h, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ActivationGuideConsole } from "@croco/admin-react";
import { GoalProgress, NextActionCard } from "@croco/frontend-react";
import type { ActivationGuideAccess, ActivationGuideState } from "@croco/admin-core";
import type {
  ActivationGuidePreviewRequest,
  ActivationGuidePublishRequest,
} from "@croco/admin-core";
import type { GoalDefinition, GoalProgress as GoalProgressResult } from "@croco/onboarding-core";

type Bootstrap = {
  access: ActivationGuideAccess;
  definition: GoalDefinition;
  state: ActivationGuideState;
  progress: GoalProgressResult;
  episodeId: string;
  subjectId: string;
};

function reviveProgress(progress: GoalProgressResult): GoalProgressResult {
  return {
    ...progress,
    episode: {
      ...progress.episode,
      startedAt: new Date(progress.episode.startedAt),
      endsAt: new Date(progress.episode.endsAt),
      achievedAt: progress.episode.achievedAt ? new Date(progress.episode.achievedAt) : undefined,
    },
  };
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    path,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = (await response.json()) as T | { error: string };
  if (!response.ok) {
    const failure = result as { error?: string };
    throw new Error(failure.error ?? `Request failed: ${response.status}`);
  }
  return result as T;
}

function App() {
  const [bootstrap, setBootstrap] = useState<Bootstrap>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportName, setReportName] = useState("My first report");
  const [saving, setSaving] = useState(false);
  const commandId = useRef<string | undefined>(undefined);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await request<Bootstrap>("/api/bootstrap");
      setBootstrap({ ...next, progress: reviveProgress(next.progress) });
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load guide");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    if (bootstrap && location.pathname === "/reports/new") {
      document.querySelector<HTMLInputElement>('[aria-label="Report name"]')?.focus();
    }
  }, [bootstrap]);

  if (loading && !bootstrap) {
    return h("main", null, h(GoalProgress, { state: { kind: "loading" } }));
  }

  if (!bootstrap) {
    return h(
      "main",
      null,
      h(GoalProgress, {
        state: {
          kind: "error",
          message: error || "Unable to load guide",
          retry: () => {
            void reload();
          },
        },
      }),
    );
  }

  const saveReport = async () => {
    commandId.current ??= crypto.randomUUID();
    setSaving(true);
    setError("");
    try {
      await request("/api/reports", { commandId: commandId.current, name: reportName });
      commandId.current = undefined;
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Report was not saved");
    } finally {
      setSaving(false);
    }
  };

  return h(
    "main",
    null,
    h("h1", null, "Activation guide example"),
    h("p", null, "A saved report is confirmed by the server before goal progress changes."),
    h(
      "div",
      { className: "layout" },
      h(
        "div",
        null,
        h(ActivationGuideConsole, {
          access: bootstrap.access,
          definition: bootstrap.definition,
          state: bootstrap.state,
          targets: [
            {
              label: "Demo member",
              subject: { id: bootstrap.subjectId, verified: true },
              episodeId: bootstrap.episodeId,
            },
          ],
          asOf: new Date().toISOString(),
          onPreview: async (input: ActivationGuidePreviewRequest) =>
            reviveProgress(await request<GoalProgressResult>("/api/preview", input)),
          onPublish: async (input: ActivationGuidePublishRequest) => {
            const published = await request<ActivationGuideState & { kind: "ready" }>(
              "/api/publish",
              input,
            );
            await reload();
            return published.published;
          },
        }),
      ),
      h(
        "div",
        null,
        h(
          "div",
          { className: "card" },
          h(GoalProgress, { state: { kind: "ready", progress: bootstrap.progress } }),
        ),
        h("div", { className: "card" }, h(NextActionCard, { progress: bootstrap.progress })),
        h(
          "section",
          { className: "card", id: "new-report" },
          h("h2", null, "Create a report"),
          h(
            "label",
            null,
            "Report name",
            h("input", {
              "aria-label": "Report name",
              value: reportName,
              onChange: (event: { target: { value: string } }) => setReportName(event.target.value),
            }),
          ),
          h(
            "button",
            { type: "button", disabled: saving || !reportName.trim(), onClick: saveReport },
            saving ? "Saving…" : "Save report",
          ),
        ),
        error ? h("p", { role: "alert" }, error) : null,
      ),
    ),
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing browser root");
createRoot(root).render(h(App));
