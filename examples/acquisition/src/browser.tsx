import { createElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AcquisitionInspector } from "@croco/admin-react/acquisition";
import type { AcquisitionInspectorState } from "@croco/admin-core/acquisition";
import { collectAcquisitionContext } from "@croco/frontend-react/acquisition";
import { AcquisitionProblem, parseAcquisitionContext } from "@croco/analytics-core/acquisition";
import { urls } from "./config";

async function request(path: string, body: unknown = {}) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw new AcquisitionProblem(response.status === 403 ? "denied" : "persistence");
  return response.json();
}
function App() {
  const [state, setState] = useState<AcquisitionInspectorState>({ kind: "loading" });
  const [message, setMessage] = useState("");
  const refresh = async () => {
    setState({ kind: "loading" });
    try {
      setState(await request("/api/compare"));
    } catch {
      setState({ kind: "error" });
    }
  };
  const act = async (path: string) => {
    try {
      await request(path);
      setMessage("Saved synthetic evidence.");
      await refresh();
    } catch {
      setMessage("The action failed; no success is assumed.");
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  const collect = async () => {
    try {
      await collectAcquisitionContext({
        enabled: true,
        location: {
          href: window.location.href,
          referrer: document.referrer,
          replace: (path) => window.history.replaceState(null, "", path),
        },
        cleanPath: "/",
        parse: (input) => parseAcquisitionContext(input, urls),
        send: (context) => request("/api/collect", context).then(() => undefined),
      });
      setMessage("Visit saved without raw URL data.");
      await refresh();
    } catch {
      setMessage("Collection failed.");
    }
  };
  return createElement(
    "main",
    null,
    createElement(
      "nav",
      {
        "aria-label": "Synthetic workflow",
        style: { display: "flex", flexWrap: "wrap", gap: ".5rem", padding: "1rem" },
      },
      createElement("button", { onClick: () => void collect() }, "Collect this visit"),
      createElement(
        "button",
        { onClick: () => void act("/api/login") },
        "Link authenticated demo user",
      ),
      createElement(
        "button",
        { onClick: () => void act("/api/logout") },
        "Logout and rotate session",
      ),
      createElement(
        "button",
        { onClick: () => void act("/api/declarations") },
        "Import conflicting self-reports",
      ),
      createElement("button", { onClick: () => void act("/api/delete") }, "Erase demo user"),
    ),
    createElement("p", { role: "status" }, message),
    createElement(AcquisitionInspector, { state, onRefresh: () => void refresh() }),
  );
}
const root = document.getElementById("root");
if (root) createRoot(root).render(createElement(App));
