import type { NextRequest } from "next/server.js";
import { randomUUID } from "node:crypto";
import type { ApplicationRuntime } from "@croco/framework-module";
import { LocalSessionProvider } from "./LocalSessionProvider";
import type { TrialIdentity } from "./product/ProductTrials";

export type Context = {
  req: NextRequest;
  application: ApplicationRuntime;
  identity: TrialIdentity | null;
  correlationId: string;
};

export async function createContext({
  req,
  application,
}: {
  req: NextRequest;
  application: ApplicationRuntime;
}): Promise<Context> {
  const user = await application.get(LocalSessionProvider).authenticate(req);
  return {
    req,
    application,
    identity: user?.tenantId ? { userId: user.id, tenantId: user.tenantId } : null,
    correlationId: randomUUID(),
  };
}
