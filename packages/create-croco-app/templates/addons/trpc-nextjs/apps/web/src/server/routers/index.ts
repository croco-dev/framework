import { router } from "../trpc";
import { healthRouter } from "./health";
import { productRouter } from "./product";

export const appRouter = router({
  health: healthRouter,
  product: productRouter,
});

export type AppRouter = typeof appRouter;
