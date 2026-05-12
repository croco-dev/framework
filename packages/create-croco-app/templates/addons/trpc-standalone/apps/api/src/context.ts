import type { CreateHTTPContextOptions } from "@trpc/server/adapters/standalone";

export type Context = {
  req: CreateHTTPContextOptions["req"];
};

export function createContext({ req }: CreateHTTPContextOptions): Context {
  return { req };
}
