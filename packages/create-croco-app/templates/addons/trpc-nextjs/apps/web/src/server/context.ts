import type { NextRequest } from "next/server.js";

export type Context = {
  req: NextRequest;
};

export function createContext({ req }: { req: NextRequest }): Context {
  return { req };
}
