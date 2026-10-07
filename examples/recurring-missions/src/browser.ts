import { createElement as h, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { ProgressCard, StreakCalendar, AchievementToast } from "@croco/frontend-react";
import type { MissionProgressState } from "@croco/frontend-react";
import { MissionConsole } from "@croco/admin-react";
import type { MissionConsoleAccess } from "@croco/admin-core";
import type { MissionProgress, MissionPublication } from "@croco/gamification-core";

type Bootstrap = {
  progress: MissionProgress;
  publication: MissionPublication;
  access: MissionConsoleAccess;
  actions: string[];
};
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`);
  return payload as T;
}
function App() {
  const [data, setData] = useState<Bootstrap>();
  const [state, setState] = useState<MissionProgressState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const command = useRef<{ name: string; commandId: string } | undefined>(undefined);
  const pending = useRef(false);
  const episodeIntent = useRef<{ version: number; commandId: string } | undefined>(undefined);
  async function load() {
    setState({ kind: "loading" });
    try {
      const result = await request<Bootstrap>("/api/bootstrap");
      setData(result);
      setState({ kind: "ready", progress: result.progress });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to read mission",
        retry: load,
      });
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    if (command.current?.name !== name) command.current = { name, commandId: crypto.randomUUID() };
    pending.current = true;
    setBusy(true);
    setMessage("");
    try {
      await request("/api/reports", command.current);
      const progress = await request<MissionProgress>("/api/progress");
      command.current = undefined;
      setState({ kind: "ready", progress });
      setMessage("Report saved and mission progress checked.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Report save failed");
      setState((current) =>
        current.kind === "ready" || current.kind === "partial"
          ? {
              kind: "partial",
              progress: current.progress,
              message: "Progress could not be refreshed. Try again to verify.",
            }
          : current,
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function startEpisode() {
    if (!data || pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage("");
    try {
      episodeIntent.current ??= {
        version: data.publication.definition.version,
        commandId: crypto.randomUUID(),
      };
      const result = await request<Bootstrap>("/api/episodes", episodeIntent.current);
      episodeIntent.current = undefined;
      command.current = undefined;
      setData(result);
      setState({ kind: "ready", progress: result.progress });
      setMessage("New episode started. Earlier progress is preserved.");
    } catch (error) {
      setMessage(
        `${error instanceof Error ? error.message : "Could not start episode"}. Retry the pending episode before starting another.`,
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return h(
    "main",
    null,
    h(
      "header",
      null,
      h("p", { className: "eyebrow" }, "CROCO / RECURRING MISSIONS"),
      h("h1", null, "Make each report count"),
      h(
        "p",
        null,
        "Save useful work, see confirmed progress, and start a fresh episode when you return.",
      ),
    ),
    h(
      "div",
      { className: "grid" },
      h(
        "section",
        null,
        h("h2", null, "Save a report"),
        h(
          "form",
          { onSubmit: save },
          h(
            "label",
            null,
            "Report name",
            h("input", {
              name: "name",
              required: true,
              maxLength: 120,
              placeholder: "Weekly research notes",
            }),
          ),
          h(
            "button",
            { type: "submit", disabled: busy || !data },
            busy ? "Saving…" : "Save report",
          ),
        ),
        message ? h("p", { role: "status" }, message) : null,
      ),
      h(ProgressCard, { state }),
      h(StreakCalendar, { state }),
    ),
    h(AchievementToast, { state }),
    data
      ? h(
          "div",
          { className: "operations" },
          h(MissionConsole, {
            access: data.access,
            state: { kind: "ready", publication: data.publication },
            registeredActions: data.actions,
            onPublish: async (publication: MissionPublication) => {
              const published = await request<MissionPublication>("/api/definition", publication);
              setData((current) => (current ? { ...current, publication: published } : current));
              return published;
            },
          }),
          h(
            "section",
            null,
            h("h2", null, "Return with a fresh goal"),
            h(
              "p",
              null,
              `Start a separate episode using published version ${data.publication.definition.version}.`,
            ),
            h(
              "button",
              { type: "button", disabled: busy, onClick: startEpisode },
              episodeIntent.current
                ? `Retry episode version ${episodeIntent.current.version}`
                : "Start new episode",
            ),
          ),
        )
      : null,
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Root element missing");
createRoot(root).render(h(App));
