import type { CreateHTTPContextOptions } from "@trpc/server/adapters/standalone";

export type Context = {
  headers: Record<string, string | string[] | undefined>;
};

export function createContext({ req }: CreateHTTPContextOptions): Context {
  return { headers: req.headers };
}
