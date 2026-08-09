import { defineContractMonetization } from "@croco/protocols-core";

export const saasMonetizationContract = defineContractMonetization({
  meters: [
    {
      key: "api_requests",
      aggregation: "COUNT",
      unit: "request",
      billing: "required",
    },
  ],
  planVersions: [
    {
      ref: "team@v1",
      planId: "team",
      versionId: "v1",
      rating: { mode: "provider", provider: "polar" },
      providerBindings: [
        {
          provider: "polar",
          productId: "team",
          priceIds: ["team-fixed-v1", "team-api-overage-v1"],
          meterBindings: [{ meterKey: "api_requests", meterId: "polar-api-requests" }],
        },
      ],
    },
  ],
  entitlementSets: [
    {
      planId: "team",
      planVersionRef: "team@v1",
      entitlements: [
        {
          featureKey: "api.requests",
          type: "metered",
          quota: 2,
          meterId: "api_requests",
          meterBilling: "required",
          overagePolicy: "ALLOW_WITH_OVERAGE",
        },
      ],
    },
  ],
  providers: [
    {
      providerName: "polar",
      capabilities: {
        checkout: { supported: true },
        usage: { supported: true },
      },
    },
  ],
  subscriptionMappings: [
    {
      subscriptionId: "subscription_tenant_acme",
      entitlementPlanVersionRef: "team@v1",
      providerPlanVersionRef: "team@v1",
    },
  ],
});
