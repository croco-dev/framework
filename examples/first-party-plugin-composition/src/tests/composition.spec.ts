import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createAuthExample } from "../auth";
import { createBillingExample } from "../billing";
import { createDatastoreExample } from "../datastore";
import {
  createProductionGoldenPathApplication,
  createProductionGoldenPathRuntime,
} from "../productionGoldenPath";
import { FIRST_PARTY_PACKAGE_READINESS, inspectApplication } from "../shared";
import { createTasksTelemetryExample } from "../tasksTelemetry";

type PackageCatalog = {
  readonly maturity: Readonly<Record<string, { readonly packages: readonly string[] }>>;
  readonly certification: {
    readonly records: readonly { readonly package: string; readonly state: string }[];
  };
};

describe("first-party plugin composition examples", () => {
  it.each([
    ["auth", createAuthExample, [["better-auth", "production", "alpha", "not-recorded"]]],
    [
      "datastore",
      createDatastoreExample,
      [["drizzle-transaction", "production", "production", "not-recorded"]],
    ],
    ["billing", createBillingExample, [["polar-billing", "beta", "beta", "uncertified"]]],
    [
      "tasks and telemetry",
      createTasksTelemetryExample,
      [
        ["node-telemetry", "production", "production", "certified"],
        ["qstash-tasks", "alpha", "alpha", "uncertified"],
      ],
    ],
  ] as const)(
    "exposes %s readiness without overstating certification",
    (_name, create, expected) => {
      expect(
        inspectApplication(create()).plugins.map(({ name, pluginMaturity, packageReadiness }) => [
          name,
          pluginMaturity,
          packageReadiness?.maturity,
          packageReadiness?.certification,
        ]),
      ).toEqual(expected);
    },
  );

  it("keeps the example readiness labels aligned with the package catalog", () => {
    const catalog = JSON.parse(
      readFileSync(resolve(import.meta.dirname, "../../../../docs/package-catalog.json"), "utf8"),
    ) as PackageCatalog;

    for (const [packageName, readiness] of Object.entries(FIRST_PARTY_PACKAGE_READINESS)) {
      const shortName = packageName.replace("@croco/", "");
      const catalogMaturity = Object.entries(catalog.maturity).find(([, { packages }]) =>
        packages.includes(shortName),
      )?.[0];
      const catalogCertification = catalog.certification.records.find(
        ({ package: recordedPackage }) => recordedPackage === packageName,
      )?.state;

      expect(catalogMaturity, packageName).toBe(readiness.maturity);
      expect(catalogCertification ?? "not-recorded", packageName).toBe(readiness.certification);
    }
  });

  it("composes a profile, application module, HTTP transport and Node host", async () => {
    const description = inspectApplication(createProductionGoldenPathApplication());
    expect(description.modules).toContain("first-party-golden-path/application");
    expect(description.plugins.map(({ name }) => name)).toEqual([
      "better-auth",
      "drizzle-transaction",
      "node-telemetry",
      "polar-billing",
      "qstash-tasks",
      "transports-http",
    ]);

    const runtime = await createProductionGoldenPathRuntime();
    try {
      const response = await runtime.app.fetch(new Request("http://localhost/golden"));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ status: "ok" });
      await runtime.host.start();
      expect(runtime.host.server?.listening).toBe(true);
    } finally {
      await runtime.dispose();
    }
  });
});
