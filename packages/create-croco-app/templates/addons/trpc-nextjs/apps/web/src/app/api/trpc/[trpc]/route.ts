import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server.js";
import { createContext } from "../../../../server/context";
import { appRouter } from "../../../../server/routers";
import { withApplication } from "../../../../server/application";

const handler = (req: NextRequest) =>
  withApplication((application) =>
    fetchRequestHandler({
      endpoint: "/api/trpc",
      req,
      router: appRouter,
      createContext: () => createContext({ req, application }),
    }),
  );

export const runtime = "nodejs";

export { handler as GET, handler as POST };
