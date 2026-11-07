import { createElement } from "react";
import type { ReactElement, ReactNode } from "react";
import type { HeadMetadata } from "../routes/head";

type SsrHeadTag =
  | { name: "meta" | "link"; attributes: Record<string, string> }
  | { name: "title" | "script"; content: string };

/** One metadata projection for both SSR serializers. All values are request-owned. */
function resolveSsrHead(head: HeadMetadata | undefined): { lang: string; tags: SsrHeadTag[] } {
  const tags: SsrHeadTag[] = [
    { name: "meta", attributes: { charSet: "utf-8" } },
    {
      name: "meta",
      attributes: { name: "viewport", content: "width=device-width, initial-scale=1" },
    },
    { name: "title", content: head?.title ?? "Croco App" },
  ];
  if (head?.description)
    tags.push({ name: "meta", attributes: { name: "description", content: head.description } });
  if (head?.ogTitle)
    tags.push({ name: "meta", attributes: { property: "og:title", content: head.ogTitle } });
  if (head?.canonical)
    tags.push({ name: "link", attributes: { rel: "canonical", href: head.canonical } });
  const publicPage = head?.publicPage;
  if (publicPage) {
    tags.push(
      { name: "meta", attributes: { name: "robots", content: publicPage.robots } },
      { name: "meta", attributes: { name: "croco:revision", content: publicPage.revision } },
      ...publicPage.alternates.map(
        (alternate): SsrHeadTag => ({
          name: "link",
          attributes: { rel: "alternate", hrefLang: alternate.locale, href: alternate.href },
        }),
      ),
      {
        name: "script",
        // Script raw text needs JSON escaping, not HTML text escaping. Apply it
        // here too so callers cannot bypass the output boundary by skipping the resolver.
        content: publicPage.jsonLd
          .replace(/</g, "\\u003c")
          .replace(/>/g, "\\u003e")
          .replace(/&/g, "\\u0026"),
      },
    );
  }
  return { lang: publicPage?.lang ?? "en", tags };
}

export function createSsrDocument(head: HeadMetadata | undefined, root: ReactNode): ReactElement {
  const { lang, tags } = resolveSsrHead(head);
  return createElement(
    "html",
    { lang },
    createElement(
      "head",
      null,
      ...tags.map((tag) => {
        if ("attributes" in tag) return createElement(tag.name, tag.attributes);
        if (tag.name === "title") return createElement("title", null, tag.content);
        return createElement("script", {
          type: "application/ld+json",
          dangerouslySetInnerHTML: { __html: tag.content },
        });
      }),
    ),
    createElement("body", null, root),
  );
}

/** Preserve the existing buffered document bytes, including safe error responses. */
export function createSsrHtmlShell(head: HeadMetadata | undefined, bodyHtml: string): string {
  const { lang, tags } = resolveSsrHead(head);
  const headHtml = tags
    .map((tag) => {
      if ("attributes" in tag) {
        const attributes = Object.entries(tag.attributes)
          .map(([name, value]) => {
            const htmlName =
              name === "charSet" ? "charset" : name === "hrefLang" ? "hreflang" : name;
            return `${htmlName}="${escapeHtml(value)}"`;
          })
          .join(" ");
        return `<${tag.name} ${attributes}>`;
      }
      if (tag.name === "title") return `<title>${escapeHtml(tag.content)}</title>`;
      return `<script type="application/ld+json">${tag.content}</script>`;
    })
    .join("\n    ");
  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
    ${headHtml}
  </head>
  <body>
    <div id="root">${bodyHtml}</div>
  </body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
