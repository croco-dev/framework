import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { createContext } from "./context.js";
import { appRouter } from "./router.js";

const server = createHTTPServer({
  router: appRouter,
  createContext,
});

const port = Number(process.env.PORT ?? "3001");

server.listen(port);
console.log(`🚀 tRPC server listening on port ${port}`);
