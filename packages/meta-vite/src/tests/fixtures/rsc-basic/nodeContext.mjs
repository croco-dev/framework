import { createElement } from "react";

export default async function NodeContextPage({ request, context }) {
  return createElement(
    "main",
    { id: "node-context" },
    `platform=${context?.platform ?? "missing"};path=${new URL(request.url).pathname};locale=${new URL(request.url).searchParams.get("locale")};tenant=${request.headers.get("x-tenant")}`,
  );
}
