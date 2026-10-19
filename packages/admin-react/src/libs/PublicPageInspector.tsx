import { createElement } from "react";
import type { PublicPageInspection } from "@croco/seo-core";

/** Server-owned report: the human view and CLI JSON consume identical diagnostics. */
export function PublicPageInspector({ report }: { readonly report: PublicPageInspection }) {
  return createElement(
    "section",
    {
      "aria-label": "Public page inspection",
      style: { maxWidth: "64rem", padding: "1.5rem", overflowWrap: "anywhere" },
    },
    createElement("h2", null, "Public page inspection"),
    createElement("p", null, `${report.targetId}: ${report.state}`),
    createElement(
      "dl",
      null,
      createElement("dt", null, "Publication"),
      createElement("dd", null, report.publication ?? "Unavailable"),
      createElement("dt", null, "HTTP status"),
      createElement("dd", null, report.responseStatus ?? "Unavailable"),
      createElement("dt", null, "Content revision"),
      createElement("dd", null, report.revision ?? "Unavailable"),
    ),
    report.diagnostics.length
      ? createElement(
          "ul",
          null,
          report.diagnostics.map((entry, index) =>
            createElement("li", { key: index }, `${entry.code} (${entry.field})`),
          ),
        )
      : createElement("p", null, "No contract mismatch found."),
    createElement("p", null, "This inspection does not guarantee indexing or search ranking."),
  );
}
