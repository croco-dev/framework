import type { AcquisitionUrlPolicy } from "@croco/analytics-core/acquisition";
export const origin = "http://127.0.0.1:4187";
export const urls: AcquisitionUrlPolicy = {
  origin,
  destinations: { home: "/" },
  campaigns: { utm_source: ["newsletter"], utm_campaign: ["spring"] },
  referrerOrigins: ["https://search.example"],
};
export const scope = { app: "acquisition-demo", environment: "local", tenantId: "synthetic" };
