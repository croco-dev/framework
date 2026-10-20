import { createElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { ApolloProvider } from "@apollo/client/react";
import { createApolloSession } from "@croco/frontend-react/apollo";
import { App } from "./App";

const outlet = document.getElementById("root");
const payload = document.getElementById("apollo-state")?.textContent;
if (!outlet || !payload) throw new Error("Missing SSR document");
const owner = (JSON.parse(payload) as { owner: string }).owner;
const options = {
  endpoint: `${location.origin}/graphql`,
  allowedOrigins: [location.origin],
  ssr: false,
};
let session = createApolloSession({ ...options, owner, hydration: payload });
const root = hydrateRoot(outlet, tree());
let switching = false;
function tree() {
  return createElement(ApolloProvider, {
    client: session.client,
    key: session.owner,
    children: createElement(App, {
      onSwitch: (target) => {
        void switchOwner(target);
      },
    }),
  });
}
async function switchOwner(target: "bob" | "south") {
  if (switching) return;
  switching = true;
  // Fence old work before starting the identity change, not after the new request returns.
  session.dispose();
  root.render(createElement("p", { role: "status" }, "Switching session…"));
  try {
    const response = await fetch("/session", {
      method: "POST",
      body: target,
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error("Session change failed");
    const next = (await response.json()) as { owner: string };
    session = createApolloSession({ ...options, owner: next.owner });
    root.render(tree());
  } catch (error) {
    root.render(
      createElement(
        "p",
        { role: "alert" },
        error instanceof Error ? error.message : "Session unavailable",
      ),
    );
  } finally {
    switching = false;
  }
}
