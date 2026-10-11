import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server.js";
import { createContext } from "../../../../server/context";
import { appRouter } from "../../../../server/routers";
import { application } from "../../../../server/application";

const handler = application.bindHostCallback((req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext({ req }),
  }),
);

export const runtime = "nodejs";

export { handler as GET, handler as POST };
