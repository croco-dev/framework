import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createReferralConsoleAttributionView,
  createReferralConsoleLinkView,
  createReferralConsoleProgramView,
  createReferralConsoleReadyState,
} from "@croco/admin-core";
import { ReferralProgramConsole } from "@croco/admin-react";
import { CreditLedgerService, InMemoryCreditLedgerStore } from "@croco/credits-core";
import type { CreditAccountId } from "@croco/credits-core";
import { ReferralProgress, ReferralShareCard } from "@croco/frontend-react";
import { InMemoryReferralStore, ReferralService } from "@croco/referral-core";
import { FirstPartyReferralCreditGrantAdapter } from "@croco/referral-core/credit-grant";
import { generateReferralToken, hashReferralToken } from "@croco/referral-core/link-token";
import type { ReferralSubject } from "@croco/referral-core";

const referrer: ReferralSubject = {
  appId: "shop",
  environment: "production",
  tenantId: "tenant-a",
  kind: "customer",
  id: "referrer-1",
};

const recipient: ReferralSubject = {
  appId: "shop",
  environment: "production",
  tenantId: "tenant-a",
  kind: "customer",
  id: "recipient-1",
};

export async function runReferralProgram(): Promise<{
  readonly funnel: { readonly clicks: number; readonly qualified: number };
  readonly console: string;
  readonly card: string;
}> {
  const ledger = new CreditLedgerService({
    store: new InMemoryCreditLedgerStore(),
    eventDelivery: "development",
  });
  const accounts = new Map<string, CreditAccountId>();
  const adapter = new FirstPartyReferralCreditGrantAdapter({
    ledger,
    resolveAccount: async ({ subject, benefit }) => {
      const key = `${subject.id}:${benefit.walletKey ?? "default"}`;
      const cached = accounts.get(key);
      if (cached) return cached;
      const opened = await ledger.openAccount({
        idempotencyKey: `example:${subject.tenantId}:${subject.id}:${benefit.walletKey ?? "default"}`,
        reference: { type: "example-account", id: subject.id },
        tenantId: subject.tenantId,
        walletKey: benefit.walletKey,
      });
      accounts.set(key, opened.account.id);
      return opened.account.id;
    },
  });
  const store = new InMemoryReferralStore();
  const service = new ReferralService({
    store,
    tokens: { generateToken: generateReferralToken, hashToken: hashReferralToken },
    novelty: () => ({ novelty: "new", reason: "authoritative signup source confirms new" }),
    qualification: () => ({
      qualified: true,
      sourceEventId: "event-1",
      qualifyingAction: "first-purchase",
      eligibleReason: "first purchase observed",
    }),
    fulfillment: adapter,
    clock: () => new Date("2026-02-01T00:00:00Z"),
  });

  const now = new Date("2026-01-15T00:00:00Z");
  const { program } = await service.registerProgram({
    id: "referral-welcome",
    version: 1,
    familyId: "referral-welcome",
    benefitCycleId: "cycle-1",
    conversionWindowMs: 30 * 24 * 60 * 60 * 1000,
    qualifyingAction: "first-purchase",
    referrerBenefit: { kind: "trial-credits", creditAmount: "10", walletKey: "referral" },
    recipientBenefit: { kind: "trial-credits", creditAmount: "5", walletKey: "welcome" },
    startsAt: new Date("2026-01-01T00:00:00Z"),
    endsAt: new Date("2026-12-31T00:00:00Z"),
    perSubjectLimit: 2,
    budgetTotal: "1000",
    budgetPerAttribution: "20",
    actorId: "operator-1",
    reason: "launch referral program",
    idempotencyKey: "program:referral-welcome:1",
  });

  const { link, token } = await service.createReferralLink({
    programId: program.id,
    referrer,
    now,
  });
  await service.recordClick({ linkId: link.id, now });
  await service.recordClick({ linkId: link.id, now });
  await service.recordClick({ linkId: link.id, now });

  const { attribution } = await service.claimAttribution({ token, recipient, now });
  const qualified = await service.qualifyAttribution({
    attributionId: attribution.id,
    recipient,
    now,
  });

  await service.cancelBenefitSide({
    attributionId: qualified.id,
    side: "recipient",
    actorId: "operator-1",
    reason: "recipient asked to decline the welcome credit",
    policy: "operator-cancel-policy",
    now,
  });
  const fulfilled = await service.fulfillBenefits({ attributionId: qualified.id, now });
  const returned = await service.returnBenefitSide({
    attributionId: fulfilled.id,
    side: "referrer",
    policy: "operator-return-policy",
    returnIdempotencyKey: `return:${fulfilled.id}:referrer`,
    actorId: "operator-1",
    reason: "fraud review reversed the referrer grant",
    now,
  });

  const funnel = await service.funnelCounts({ programId: program.id });
  const links = await store.listLinks({ programId: program.id });
  const budgetReserved = await store.readBudgetReserved(program.id, program.version);
  const grantedPermissions = ["referrals:read", "referrals:write", "referrals:resolve"];
  const programView = createReferralConsoleProgramView(program, budgetReserved, now);
  const snapshot = {
    scope: { appId: "shop", environment: "production" },
    generatedAt: now,
    programs: [programView],
    links: links.map((entry) => createReferralConsoleLinkView(entry, grantedPermissions)),
    attributions: [createReferralConsoleAttributionView(returned, grantedPermissions)],
    funnel,
    nextShareCycle: "cycle-2",
  };
  const ready = createReferralConsoleReadyState(snapshot, grantedPermissions);
  const console = renderToStaticMarkup(h(ReferralProgramConsole, { state: ready }));
  const card = renderToStaticMarkup(
    h(ReferralShareCard, {
      state: {
        kind: "ready",
        link,
        shareHref: `https://shop.example/referrals/claim?token=${token}`,
        expiresAt: link.expiresAt,
      },
      programName: program.id,
    }),
  );
  const progress = renderToStaticMarkup(
    h(ReferralProgress, {
      state: {
        kind: "ready",
        attribution: returned,
        referrerBenefit: program.referrerBenefit,
        recipientBenefit: program.recipientBenefit,
        funnel,
      },
      role: "referrer",
    }),
  );
  const referrerAccount = accounts.get(`${referrer.id}:referral`);
  if (!referrerAccount) throw new Error("referrer account was not opened");
  await ledger.getBalance(referrerAccount);
  return {
    funnel: { clicks: funnel.clicks, qualified: funnel.qualified },
    console,
    card: `${card}${progress}`,
  };
}

async function main(): Promise<void> {
  const result = await runReferralProgram();
  process.stdout.write(`clicks ${result.funnel.clicks} qualified ${result.funnel.qualified}\n`);
  process.stdout.write(`${result.card}\n${result.console}\n`);
}

if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  void main();
}
