import { useState } from "react";
import { GrowthWorkbenchProblem } from "@croco/admin-core";
import { createRoot } from "react-dom/client";
import { GrowthModelWorkbench } from "@croco/admin-react";
import type { GrowthWorkbenchClient } from "@croco/admin-react";
import { request } from "./fixture";
function App() {
  const [mode, setMode] = useState("ready");
  async function post(path: string, input: unknown) {
    const response = await fetch(`/api/${path}?mode=${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new GrowthWorkbenchProblem("source-failed");
    return response.json();
  }
  const client: GrowthWorkbenchClient = {
    load: (value) => post("load", { request: value }),
    save: (value, id, revision, hash) => post("save", { request: value, id, revision, hash }),
    readSaved: async (_scope, id) => {
      const response = await fetch("/api/saved?" + new URLSearchParams({ mode, id }));
      if (!response.ok) throw new GrowthWorkbenchProblem("denied");
      return (await response.json()) ?? undefined;
    },
  };
  return (
    <main>
      <p>Synthetic standalone demo · no production data, ML service or database</p>
      <label>
        Source state{" "}
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          {["ready", "empty", "partial", "denied", "error"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <GrowthModelWorkbench key={mode} client={client} initialRequest={request} />
    </main>
  );
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
