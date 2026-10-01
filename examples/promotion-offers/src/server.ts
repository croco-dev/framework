import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createOfferConsoleClaimView,
  createOfferConsolePolicyView,
  validateOfferPolicyEditor,
} from "@croco/admin-core";
import { OfferConsole } from "@croco/admin-react";
import { CreditLedgerService, InMemoryCreditLedgerStore } from "@croco/credits-core";
import { MyBenefits, OfferCard } from "@croco/frontend-react";
import { InMemoryPromotionStore, OfferService } from "@croco/promotions-core";
import { FirstPartyCreditGrantAdapter } from "@croco/promotions-core/credit-grant";
import type { OfferQuote, OfferSubject } from "@croco/promotions-core";

const operator = { actorId: "operator-1", reason: "q4 trial campaign" };
const subject: OfferSubject = {
  appId: "shop",
  environment: "production",
  tenantId: "tenant-a",
  kind: "customer",
  id: "customer-1",
};

export async function runPromotionOffers(): Promise<{
  readonly quote: OfferQuote;
  readonly grantRef: string;
  readonly available: string;
  readonly card: string;
  readonly benefits: string;
  readonly console: string;
}> {
  const ledger = new CreditLedgerService({
    store: new InMemoryCreditLedgerStore(),
    eventDelivery: "development",
  });
  const adapter = new FirstPartyCreditGrantAdapter({
    ledger,
    resolveAccount: async ({ subject: candidate, benefit }) => {
      const opened = await ledger.openAccount({
        idempotencyKey: `example:${candidate.tenantId}:${benefit.walletKey ?? "default"}`,
        reference: { type: "example-account", id: candidate.id },
        tenantId: candidate.tenantId,
        walletKey: benefit.walletKey,
      });
      return opened.account.id;
    },
  });
  const store = new InMemoryPromotionStore();
  const service = new OfferService({ store, fulfillment: adapter });

  const editor = validateOfferPolicyEditor(
    {
      id: "welcome-trial",
      versionText: "1",
      familyId: "",
      benefitCycleId: "2026-q4",
      benefitKind: "trial-credits",
      creditAmount: "30",
      walletKey: "trial",
      percentBpsText: "",
      maxDiscountAmountText: "",
      currency: "",
      supportedProvidersText: "",
      startsAtText: "2026-09-01T00:00:00.000Z",
      endsAtText: "2026-12-31T00:00:00.000Z",
      perSubjectLimitText: "1",
      budgetTotal: "100",
      budgetPerClaim: "30",
      stackingGroup: "",
      allowStacking: false,
      eligibilityRevision: "r1",
      actorId: operator.actorId,
      reason: operator.reason,
      idempotencyKey: "example-policy-v1",
    },
    new Date("2026-09-29T00:00:00Z"),
  );
  if (!editor.ok) throw new Error(`editor draft invalid: ${JSON.stringify(editor.fieldErrors)}`);
  const { policy } = await service.registerPolicy(editor.input);

  const quote = await service.quoteOffer({
    policy: { id: policy.id, version: policy.version },
    subject,
  });
  const card = renderToStaticMarkup(
    h(OfferCard, {
      state: { kind: "exposed", quote },
      onAccept: () => undefined,
      onReject: () => undefined,
    }),
  );

  const reserved = await service.reserveClaim({
    quoteId: quote.id,
    subject,
    logicalKey: "example-claim-1",
  });
  const fulfilled = await service.fulfillClaim({ claimId: reserved.claim.id });

  const account = await ledger.openAccount({
    idempotencyKey: "example:tenant-a:trial",
    reference: { type: "example-account", id: subject.id },
    tenantId: subject.tenantId,
    walletKey: "trial",
  });
  const balance = await ledger.getBalance(account.account.id);
  const benefits = renderToStaticMarkup(
    h(MyBenefits, {
      entries: [{ quote, state: fulfilled.state, grantRef: fulfilled.grantRef }],
    }),
  );
  const policyView = createOfferConsolePolicyView(policy, "30", new Date("2026-10-01T00:00:00Z"));
  const claimView = createOfferConsoleClaimView(fulfilled, ["promotions:read"]);
  const console = renderToStaticMarkup(
    h(OfferConsole, {
      state: {
        kind: "ready",
        snapshot: {
          scope: { appId: "shop", environment: "production" },
          generatedAt: new Date("2026-10-01T00:00:00Z"),
          policies: [policyView],
          claims: [claimView],
          pendingBudget: "0",
        },
        grantedPermissions: ["promotions:read"],
        actions: [],
      },
    }),
  );
  return {
    quote,
    grantRef: fulfilled.grantRef ?? "",
    available: balance.available,
    card,
    benefits,
    console,
  };
}

async function main(): Promise<void> {
  const result = await runPromotionOffers();
  process.stdout.write(`quote ${result.quote.id} face ${result.quote.faceAmount}\n`);
  process.stdout.write(`grant ${result.grantRef} available ${result.available}\n`);
  process.stdout.write(`${result.card}\n${result.benefits}\n${result.console}\n`);
}

if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  void main();
}
