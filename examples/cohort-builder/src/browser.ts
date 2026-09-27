import { createElement as h, useState } from "react";
import { createRoot } from "react-dom/client";
import { CohortBuilder } from "@croco/admin-react";
import type { CohortBuilderProps } from "@croco/admin-react";
import type { CohortBuilderState } from "@croco/admin-core";

async function api(path: string, body?: unknown) {
  const response = await fetch(
    path,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.detail), { code: result.code });
  return result;
}
function App({
  config,
}: {
  config: Pick<CohortBuilderProps, "definition" | "registration" | "asOf" | "state">;
}) {
  const [state, setState] = useState<CohortBuilderState>(config.state);
  const [members, setMembers] = useState<readonly { subjectId: string }[]>();
  return h(
    "main",
    null,
    h("h1", null, "Trial customer audience"),
    h(
      "p",
      null,
      "PostgreSQL source · three synthetic customers · report coverage through 27 September 2026",
    ),
    h(CohortBuilder, {
      ...config,
      state,
      actor: "demo-operator",
      canPreview: true,
      canPublish: true,
      onPreview: async (request) => {
        setState(await api("/api/preview", request));
        setMembers(undefined);
      },
      onPublish: async (request) => {
        const result = await api("/api/publish", request);
        setState(result.state);
        setMembers(result.members);
      },
    }),
    members
      ? h(
          "section",
          { "aria-label": "Published audience" },
          h("h2", null, "Published audience"),
          h("p", null, "Read through PublishedCohortReader and CohortAudienceSource"),
          h(
            "ul",
            null,
            members.map((member) => h("li", { key: member.subjectId }, member.subjectId)),
          ),
        )
      : null,
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Example root is missing");
const app = createRoot(root);
void api("/api/config")
  .then((config) => app.render(h(App, { config })))
  .catch((error) => app.render(h("p", { role: "alert" }, String(error))));
