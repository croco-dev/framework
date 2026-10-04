import type { NextRequest } from "next/server.js";
import { randomUUID } from "node:crypto";
import { application } from "./application";
import { LocalSessionProvider } from "./LocalSessionProvider";
import type { TrialIdentity } from "./product/ProductTrials";

export type Context = {
  req: NextRequest;
  identity: TrialIdentity | null;
  correlationId: string;
};

export async function createContext({ req }: { req: NextRequest }): Promise<Context> {
  const user = await application.get(LocalSessionProvider).authenticate(req);
  return {
    req,
    identity: user?.tenantId ? { userId: user.id, tenantId: user.tenantId } : null,
    correlationId: randomUUID(),
  };
}
