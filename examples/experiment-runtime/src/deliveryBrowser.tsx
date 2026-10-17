import { createElement as h, useEffect, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import {
  ExperimentRegion,
  ExperimentDeliveryClientProblem,
} from "@croco/frontend-react/experiments";
import type { ExperimentRegionDecision } from "@croco/frontend-react/experiments";
import { variantContent } from "./deliveryView";
const script = document.getElementById("delivery");
const initial = JSON.parse(script?.textContent ?? "null") as ExperimentRegionDecision;
const serialized = script?.textContent ?? "";
function App() {
  const [interaction, setInteraction] = useState("Ready");
  const [scopeKey, setScopeKey] = useState("initial");
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  // The host owns a monotonic session generation. Changing it hides the old decision synchronously.
  Object.assign(window, { switchDeliveryScope: () => setScopeKey("changed") });
  return h(
    "main",
    null,
    h("h1", null, "Checkout assurance"),
    h("p", null, "Local delivery bridge · synthetic identities"),
    h(ExperimentRegion, {
      decision: initial,
      scopeKey: "initial",
      activeScopeKey: scopeKey,
      renderVariant: (variant, value) =>
        variantContent(variant, value, () => setInteraction(`Clicked ${variant}`)),
      fallback: h("p", null, "Standard checkout"),
      admit: new URL(location.href).searchParams.has("consume")
        ? async (receipt, signal) => {
            try {
              const response = await fetch("/admit", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ receipt }),
                signal,
              });
              if (!response.ok)
                throw new ExperimentDeliveryClientProblem(`Admission failed: ${response.status}`);
              return (await response.json()) as ExperimentRegionDecision;
            } finally {
              Object.assign(window, { admissionSettled: true });
            }
          }
        : undefined,
      report: async (body) => {
        const response = await fetch("/exposure", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok)
          throw new ExperimentDeliveryClientProblem(`Exposure failed: ${response.status}`);
      },
      onObservationError: (error) => {
        Object.assign(window, { observationError: String(error) });
      },
    }),
    h("output", { id: "interaction" }, interaction),
    h("script", {
      id: "delivery",
      type: "application/json",
      dangerouslySetInnerHTML: { __html: serialized },
    }),
  );
}
const root = document.getElementById("root");
if (root) hydrateRoot(root, h(App));
