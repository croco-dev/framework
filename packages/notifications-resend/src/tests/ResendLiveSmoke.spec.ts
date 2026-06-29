import { describe, expect, it } from "vitest";
import { ResendProvider } from "../libs/ResendProvider";

const liveConfig = {
  apiKey: process.env.RESEND_API_KEY ?? "",
  from: process.env.RESEND_FROM ?? "",
  to: process.env.RESEND_SMOKE_TO ?? "",
};

const missingLiveSmokeEnv = [
  ["CROCO_LIVE_RESEND", process.env.CROCO_LIVE_RESEND === "true" ? "true" : ""],
  ["RESEND_API_KEY", liveConfig.apiKey],
  ["RESEND_FROM", liveConfig.from],
  ["RESEND_SMOKE_TO", liveConfig.to],
]
  .filter(([, value]) => typeof value !== "string" || value.length === 0)
  .map(([name]) => name);

describe("Resend live smoke", () => {
  it.skipIf(missingLiveSmokeEnv.length > 0)(
    "requires CROCO_LIVE_RESEND, RESEND_API_KEY, RESEND_FROM, and RESEND_SMOKE_TO for live Resend send smoke",
    async () => {
      const provider = new ResendProvider({
        apiKey: liveConfig.apiKey,
        from: liveConfig.from,
      });

      const result = await provider.send(
        {
          to: liveConfig.to,
          subject: "Croco Resend live smoke",
          content: "<p>Croco Resend live smoke passed.</p>",
        },
        { idempotencyKey: `croco-resend-live-smoke-${Date.now()}` },
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toEqual(expect.any(String));
    },
  );
});
