import { request } from "./request";
import { createElement as h, useCallback, useEffect, useState } from "react";
import { SavedItems } from "@croco/frontend-react";
import { SavedIntentConsole } from "@croco/admin-react";
import type { SavedItemsState } from "@croco/frontend-react";
import type { SavedIntentAdminState, SavedIntentInspection } from "@croco/admin-core";
import type {
  ResolvedCandidate,
  SavedIntent,
  SavedIntentPage,
  SavedIntentPolicy,
} from "@croco/experience-core";

function denied(error: unknown): boolean {
  return error instanceof Error && "status" in error && error.status === 403;
}
export function App() {
  const [state, setState] = useState<SavedItemsState>({ kind: "loading" });
  const [adminState, setAdminState] = useState<SavedIntentAdminState>({ kind: "loading" });
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const reload = useCallback(async (offset = 0): Promise<void> => {
    setState({ kind: "loading" });
    try {
      const page = await request<SavedIntentPage>("/api/list", { offset });
      setState(
        page.candidates.length === 0 && page.nextOffset === undefined
          ? { kind: "empty" }
          : {
              kind: page.candidates.some((item) => item.availability !== "available")
                ? "partial"
                : "ready",
              page,
            },
      );
    } catch (error) {
      setState({
        kind: denied(error) ? "denied" : "error",
        message: "Saved items could not be loaded. Restore access or the connection, then reload.",
      });
      throw error;
    }
  }, []);
  const loadAdmin = useCallback(async (): Promise<void> => {
    setAdminState({ kind: "loading" });
    try {
      setAdminState({ kind: "ready", policies: [await request<SavedIntentPolicy>("/api/policy")] });
    } catch (error) {
      setAdminState({
        kind: denied(error) ? "denied" : "error",
        message: "Saved intent policy is unavailable.",
      });
    }
  }, []);
  useEffect(() => {
    void reload().catch(() => undefined);
    void loadAdmin();
  }, [reload, loadAdmin]);
  const mutate = async (path: string, intent: SavedIntent, extra = {}): Promise<void> => {
    await request(path, {
      resourceId: intent.resourceId,
      sourceKind: intent.sourceKind,
      expectedRevision: intent.revision,
      idempotencyKey: crypto.randomUUID(),
      ...extra,
    });
    await reload();
  };
  const save = async (resourceId: string): Promise<void> => {
    if (saving) return;
    setSaving(true);
    setNotice("");
    try {
      const existing = await request<SavedIntent | null>("/api/identity", {
        resourceId,
        sourceKind: "explicit",
      });
      await request("/api/save", {
        resourceId,
        sourceKind: "explicit",
        expectedRevision: existing?.revision ?? null,
        idempotencyKey: crypto.randomUUID(),
      });
      await reload();
      setNotice("Report saved.");
    } catch {
      setNotice(
        "Save failed. The report may already be saved or your access may have changed. Reload saved items.",
      );
    } finally {
      setSaving(false);
    }
  };
  return h(
    "main",
    null,
    h("h1", null, "Save a report. Continue where you left off."),
    h("p", null, "Private saved reports for the local demo customer."),
    h(
      "section",
      { "aria-label": "Report library" },
      h("h2", null, "Reports"),
      ...["quarterly", "forecast", "retention"].map((id) =>
        h(
          "button",
          { key: id, type: "button", disabled: saving, onClick: () => void save(id) },
          `Save ${id}`,
        ),
      ),
      notice ? h("p", { role: "status" }, notice) : null,
    ),
    h(SavedItems, {
      state,
      onReload: () => reload(),
      onNextPage: reload,
      onContinue: async (intent) => {
        const resolved = await request<ResolvedCandidate>("/api/resolve", {
          resourceId: intent.resourceId,
          sourceKind: intent.sourceKind,
        });
        if (resolved.availability !== "available" || !resolved.safeUrl) {
          await reload();
          return;
        }
        const destination = new URL(resolved.safeUrl, window.location.origin);
        if (
          destination.origin !== window.location.origin ||
          destination.username ||
          destination.password
        )
          throw new Error("Navigation origin is not allowed");
        window.location.assign(destination.href);
      },
      onRemove: (intent) => mutate("/api/remove", intent),
      onComplete: (intent) => mutate("/api/complete", intent),
      onPin: (intent, pinOrder) => mutate("/api/pin", intent, { pinOrder }),
    }),
    h(SavedIntentConsole, {
      state: adminState,
      canWrite: true,
      targets: [{ id: "current-customer", label: "Local customer" }],
      onReload: () => void loadAdmin(),
      onSave: async ({ policy, expectedRevision, reason, idempotencyKey }) => {
        const result = await request<SavedIntentPolicy>("/api/policy/save", {
          displayLimit: policy.displayLimit,
          retentionDays: policy.retentionDays,
          excludeCompleted: policy.excludeCompleted,
          expectedRevision,
          reason,
          idempotencyKey,
        });
        setAdminState({ kind: "ready", policies: [result] });
        await reload();
        return result;
      },
      onInspect: (targetId, offset) =>
        request<SavedIntentInspection>("/api/inspect", { targetId, offset }),
    }),
  );
}
