import type {
  LambdaContext,
  LambdaEvent,
  LambdaHandler,
  LambdaResponse,
} from "@croco/transports-http";
import { CrocoLambdaAdapter } from "@croco/transports-http";
import { Hono } from "hono";
import type { LambdaPresetOptions } from "./types";

export type { LambdaContext, LambdaEvent, LambdaHandler, LambdaResponse };

export function createLambdaHandler(
  honoApp: Hono | { readonly fetch: (req: Request) => Promise<Response> },
  options?: LambdaPresetOptions,
): LambdaHandler {
  void options;

  if (honoApp instanceof Hono) {
    return new CrocoLambdaAdapter(honoApp).createHandler();
  }

  const hono = new Hono();
  hono.all("/*", (c) => honoApp.fetch(c.req.raw));

  return new CrocoLambdaAdapter(hono).createHandler();
}
