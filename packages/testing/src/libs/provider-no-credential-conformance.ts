import * as assert from "node:assert/strict";

export type ProviderNoCredentialDiagnostic = {
  readonly code: string;
  readonly details?: unknown;
  readonly message: string;
};

export type ProviderNoCredentialProbeResult = {
  readonly diagnostic: ProviderNoCredentialDiagnostic;
  readonly networkAttempts: number;
};

export type ProviderNoCredentialScenario = {
  readonly diagnosticTokens: readonly string[];
  readonly expectedCode: string;
  readonly missingEnvironment: readonly string[];
  readonly name: string;
  run(): Promise<ProviderNoCredentialProbeResult> | ProviderNoCredentialProbeResult;
};

export type ProviderNoCredentialConformanceOptions = {
  readonly providerName: string;
  readonly scenarios: readonly ProviderNoCredentialScenario[];
  readonly secretSamples: readonly [string, ...string[]];
};

export type ProviderNoCredentialConformanceCase = {
  readonly name: string;
  run(): Promise<void>;
};

export type ProviderNoCredentialConformanceSuite = {
  readonly cases: readonly ProviderNoCredentialConformanceCase[];
};

export function createProviderNoCredentialConformanceSuite(
  options: ProviderNoCredentialConformanceOptions,
): ProviderNoCredentialConformanceSuite {
  assertNonEmpty(options.providerName, "No-credential conformance requires providerName.");

  return {
    cases: [
      {
        name: `${options.providerName}: declares at least one no-credential scenario`,
        run: async () => {
          assert.ok(
            options.scenarios.length > 0,
            `${options.providerName} must declare at least one no-credential scenario.`,
          );
          assert.ok(
            options.secretSamples?.length > 0,
            `${options.providerName} must provide at least one secret sample for redaction evidence.`,
          );
          for (const secret of options.secretSamples) {
            assertNonEmpty(secret, `${options.providerName} secret samples must not be blank.`);
          }
        },
      },
      ...options.scenarios.flatMap((scenario) => createScenarioCases(options, scenario)),
    ],
  };
}

function createScenarioCases(
  options: ProviderNoCredentialConformanceOptions,
  scenario: ProviderNoCredentialScenario,
): ProviderNoCredentialConformanceCase[] {
  const label = `${options.providerName} ${scenario.name}`;

  return [
    {
      name: `${label}: reports a stable actionable diagnostic`,
      run: async () => {
        validateScenarioDeclaration(options.providerName, scenario);
        const first = await runWithoutEnvironment(scenario);
        const second = await runWithoutEnvironment(scenario);

        assertDiagnostic(options.providerName, scenario, first.diagnostic);
        assertDiagnostic(options.providerName, scenario, second.diagnostic);
        assert.deepEqual(
          second.diagnostic,
          first.diagnostic,
          `${label} must produce the same diagnostic for the same missing environment.`,
        );
      },
    },
    {
      name: `${label}: makes no live network or API call`,
      run: async () => {
        validateScenarioDeclaration(options.providerName, scenario);
        const result = await runWithoutEnvironment(scenario);

        assert.equal(
          result.networkAttempts,
          0,
          `${label} must fail or report readiness before attempting a live network/API call.`,
        );
      },
    },
    {
      name: `${label}: redacts secret-like configuration values`,
      run: async () => {
        validateScenarioDeclaration(options.providerName, scenario);
        const result = await runWithoutEnvironment(scenario);
        const serialized = serializeDiagnostic(result.diagnostic, label);

        for (const secret of options.secretSamples) {
          assert.ok(
            !serialized.includes(secret),
            `${label} diagnostic leaked a configured secret sample.`,
          );
        }
      },
    },
  ];
}

async function runWithoutEnvironment(
  scenario: ProviderNoCredentialScenario,
): Promise<ProviderNoCredentialProbeResult> {
  const previous = new Map<string, string | undefined>();

  for (const name of scenario.missingEnvironment) {
    previous.set(name, process.env[name]);
    delete process.env[name];
  }

  try {
    const result = await scenario.run();
    assert.ok(
      Number.isInteger(result.networkAttempts) && result.networkAttempts >= 0,
      `${scenario.name} must report a non-negative integer networkAttempts count.`,
    );
    return result;
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

function validateScenarioDeclaration(
  providerName: string,
  scenario: ProviderNoCredentialScenario,
): void {
  assertNonEmpty(scenario.name, `${providerName} no-credential scenario requires a name.`);
  assertNonEmpty(
    scenario.expectedCode,
    `${providerName} ${scenario.name} requires an expected diagnostic code.`,
  );
  assert.ok(
    scenario.missingEnvironment.length > 0,
    `${providerName} ${scenario.name} must declare missing environment variables.`,
  );
  assert.ok(
    scenario.diagnosticTokens.length > 0,
    `${providerName} ${scenario.name} must declare actionable diagnostic tokens.`,
  );

  for (const environmentName of scenario.missingEnvironment) {
    assert.match(
      environmentName,
      /^[A-Z][A-Z0-9_]*$/,
      `${providerName} ${scenario.name} has invalid environment name '${environmentName}'.`,
    );
  }
}

function assertDiagnostic(
  providerName: string,
  scenario: ProviderNoCredentialScenario,
  diagnostic: ProviderNoCredentialDiagnostic,
): void {
  assert.equal(
    diagnostic.code,
    scenario.expectedCode,
    `${providerName} ${scenario.name} must use the stable expected diagnostic code.`,
  );
  assertNonEmpty(
    diagnostic.message,
    `${providerName} ${scenario.name} must provide an actionable diagnostic message.`,
  );

  const serialized = serializeDiagnostic(diagnostic, `${providerName} ${scenario.name}`);
  for (const token of scenario.diagnosticTokens) {
    assertNonEmpty(token, `${providerName} ${scenario.name} diagnostic tokens must not be blank.`);
    assert.ok(
      serialized.includes(token),
      `${providerName} ${scenario.name} diagnostic must identify '${token}'.`,
    );
  }
}

function serializeDiagnostic(diagnostic: ProviderNoCredentialDiagnostic, label: string): string {
  const serialized = JSON.stringify(diagnostic);
  assert.ok(serialized, `${label} diagnostic must be JSON serializable.`);
  return serialized;
}

function assertNonEmpty(value: string, message: string): void {
  assert.ok(value.trim().length > 0, message);
}
