import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { application } from "../application";
import { isLocalSameOrigin } from "../LocalSessionProvider";
import { ProductTrials, TrialProblem, trialInputSchema } from "../product/ProductTrials";
import { publicProcedure, router } from "../trpc";

const authenticated = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.identity)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Sign in to create or read a private brief.",
    });
  if (ctx.req.method === "POST" && !isLocalSameOrigin(ctx.req)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "A same-origin request is required." });
  }
  return next({ ctx: { ...ctx, identity: ctx.identity } });
});

async function domainCall<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof TrialProblem) {
      const code =
        error.status === 404
          ? "NOT_FOUND"
          : error.status === 409
            ? "CONFLICT"
            : error.status === 400
              ? "BAD_REQUEST"
              : "INTERNAL_SERVER_ERROR";
      throw new TRPCError({ code, message: error.message, cause: error });
    }
    throw error;
  }
}

export const productRouter = router({
  create: authenticated
    .input(trialInputSchema)
    .mutation(({ ctx, input }) =>
      domainCall(() =>
        application.get(ProductTrials).create(ctx.identity, input, ctx.correlationId),
      ),
    ),
  get: authenticated
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) =>
      domainCall(() => application.get(ProductTrials).get(ctx.identity, input.id)),
    ),
});
