import { createElement as h, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { RewardConsole } from "@croco/admin-react";
import { BadgeShelf, RewardReceipt } from "@croco/frontend-react";
import type { RewardViewState } from "@croco/frontend-react";
import type { RewardAdminAccess } from "@croco/admin-core";
import type {
  RewardAccount,
  RewardGrant,
  PublishedRewardPolicy,
  RewardPublication,
} from "@croco/gamification-core";

type State = {
  access: RewardAdminAccess;
  publication: PublishedRewardPolicy;
  account: RewardAccount;
};
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
  const value = await response.json();
  if (!response.ok) throw new Error(value.error);
  return value as T;
}
function App() {
  const [data, setData] = useState<State>();
  const [account, setAccount] = useState<RewardViewState<RewardAccount>>({ kind: "loading" });
  const [receipt, setReceipt] = useState<RewardViewState<RewardGrant>>({ kind: "empty" });
  const [pending, setPending] = useState(false);
  const [title, setTitle] = useState("My first report");
  const reload = useCallback(async () => {
    try {
      const next = await request<State>("/api/state");
      setData(next);
      setAccount({ kind: "ready", value: next.account });
      const recovered = next.account.grants.find((grant) => grant.policyId === "first-report");
      if (recovered) setReceipt({ kind: "ready", value: recovered });
    } catch (cause) {
      setAccount({
        kind: "error",
        message: String(cause),
        reload: () => {
          void reload();
        },
      });
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  const save = async () => {
    setPending(true);
    setReceipt({ kind: "loading" });
    try {
      const grant = await request<RewardGrant>("/api/report", { title });
      setReceipt({ kind: "ready", value: grant });
      await reload();
    } catch (cause) {
      setReceipt({
        kind: "error",
        message: `${String(cause)}. Check account status before resubmitting.`,
        reload: () => {
          void reload();
        },
      });
    } finally {
      setPending(false);
    }
  };
  return h(
    "main",
    null,
    h("h1", null, "Achievement rewards"),
    h(
      "p",
      null,
      "Save your first report. The server confirms ownership before awarding achievement points.",
    ),
    data
      ? h(RewardConsole, {
          access: data.access,
          publication: data.publication,
          onPublish: async (input: RewardPublication) => {
            const result = await request<PublishedRewardPolicy>("/api/publish", input);
            await reload();
            return result;
          },
        })
      : null,
    h(
      "section",
      null,
      h("h2", null, "Save a report"),
      h(
        "form",
        {
          onSubmit: (event) => {
            event.preventDefault();
            void save();
          },
        },
        h(
          "label",
          null,
          "Report title",
          h("input", {
            required: true,
            maxLength: 120,
            value: title,
            disabled: pending,
            onChange: (event: { target: { value: string } }) => setTitle(event.target.value),
          }),
        ),
        h(
          "button",
          { type: "submit", disabled: pending || !data },
          pending ? "Saving…" : "Save report",
        ),
      ),
    ),
    h(RewardReceipt, { state: receipt }),
    h(BadgeShelf, { state: account }),
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing root");
createRoot(root).render(h(App));
