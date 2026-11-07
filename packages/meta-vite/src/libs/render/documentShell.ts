import { createElement } from "react";
import type { ReactElement, ReactNode } from "react";
import type { HeadMetadata } from "../routes/head";

/** One head projection for buffered and shell-first SSR. Metadata is request-owned. */
export function createSsrDocument(head: HeadMetadata | undefined, root: ReactNode): ReactElement {
  const tags = [
    createElement("meta", { charSet: "utf-8" }),
    createElement("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
    createElement("title", null, head?.title ?? "Croco App"),
  ];
  if (head?.description)
    tags.push(createElement("meta", { name: "description", content: head.description }));
  if (head?.ogTitle)
    tags.push(createElement("meta", { property: "og:title", content: head.ogTitle }));
  if (head?.canonical) tags.push(createElement("link", { rel: "canonical", href: head.canonical }));
  const publicPage = head?.publicPage;
  if (publicPage) {
    tags.push(
      createElement("meta", { name: "robots", content: publicPage.robots }),
      createElement("meta", { name: "croco:revision", content: publicPage.revision }),
      ...publicPage.alternates.map((alternate) =>
        createElement("link", {
          rel: "alternate",
          hrefLang: alternate.locale,
          href: alternate.href,
        }),
      ),
      createElement("script", {
        type: "application/ld+json",
        // Script raw text needs JSON escaping, not HTML text escaping. Apply it
        // here too so callers cannot bypass the boundary by skipping the resolver.
        dangerouslySetInnerHTML: {
          __html: publicPage.jsonLd
            .replace(/</g, "\\u003c")
            .replace(/>/g, "\\u003e")
            .replace(/&/g, "\\u0026"),
        },
      }),
    );
  }
  return createElement(
    "html",
    { lang: publicPage?.lang ?? "en" },
    createElement("head", null, ...tags),
    createElement("body", null, root),
  );
}
