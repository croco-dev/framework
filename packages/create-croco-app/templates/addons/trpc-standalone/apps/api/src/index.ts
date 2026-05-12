import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { createContext } from "./context.js";
import { appRouter } from "./router.js";

const server = createHTTPServer({
  router: appRouter,
  createContext,
});

server.listen(3001);
console.log("🚀 tRPC server listening on port 3001");
