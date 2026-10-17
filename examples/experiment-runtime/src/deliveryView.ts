import { createElement as h } from "react";
import type { ExperimentRenderDecision } from "@croco/features-core";

export function variantContent(
  variant: string,
  value: string | boolean | number,
  onClick?: () => void,
) {
  return h("button", { type: "button", "data-variant": variant, onClick }, String(value));
}
/** Plain server elements are supported in the real Node Flight path; no client-reference claim. */
export function DeliveryPage({ request }: { request: Request }) {
  const decision = JSON.parse(
    request.headers.get("x-local-delivery") ?? "null",
  ) as ExperimentRenderDecision;
  return h(
    "main",
    null,
    h("h1", null, "Checkout assurance"),
    h("p", null, "Local delivery bridge · synthetic identities"),
    h(
      "div",
      { "data-experiment-region": decision.region, "data-delivery": decision.deliveryId },
      decision.status === "assigned" &&
        decision.phase === "admitted" &&
        decision.variant !== undefined &&
        decision.value !== undefined
        ? variantContent(decision.variant, decision.value)
        : h("p", null, "Standard checkout"),
    ),
    h("output", { id: "interaction" }, "Ready"),
    h("script", {
      id: "delivery",
      type: "application/json",
      dangerouslySetInnerHTML: { __html: JSON.stringify(decision).replace(/</g, "\\u003c") },
    }),
  );
}
