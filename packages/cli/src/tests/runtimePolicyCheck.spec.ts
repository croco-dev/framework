import type { PolicyTable, RuntimeCapabilityName } from "@croco/framework-context";
import { describe, expect, it } from "vitest";
import { runRuntimePolicyCheck } from "../commands/runtimePolicy.js";

describe("runtimePolicyCheck", () => {
  it("fails a Cloudflare Workers manifest that requires nodeApi", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runRuntimePolicyCheck(
      ["--manifest", "policy.json", "--target", "cloudflare-workers"],
      {
        io: {
          cwd: "/workspace/app",
          readFile: () => JSON.stringify({ table: createPolicyTable(["nodeApi"]) }),
          stdout: (message) => stdout.push(message),
          stderr: (message) => stderr.push(message),
        },
      },
    );

    expect(exitCode).toBe(1);
    expect(stderr).toEqual([]);
    expect(stdout).toEqual([
      "ERROR framework-context/policy-capability-unavailable route 'WorkersController#create': Policy 'retry' for route 'WorkersController#create' requires runtime capability 'nodeApi'. Target runtime 'cloudflare-workers' does not provide it.",
      "Runtime policy check failed with 1 error(s).",
    ]);
  });

  it("prints a JSON failure report for a Lambda manifest that requires shutdown", async () => {
    const stdout: string[] = [];

    const exitCode = await runRuntimePolicyCheck(["policy.json", "--json"], {
      io: {
        cwd: "/workspace/app",
        readFile: () =>
          JSON.stringify({
            runtime: { platform: "lambda" },
            table: createPolicyTable(["shutdown"]),
          }),
        stdout: (message) => stdout.push(message),
      },
    });

    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout[0] ?? "{}")).toMatchObject({
      status: "fail",
      target: "lambda",
      planCount: 1,
      diagnostics: [
        {
          code: "framework-context/policy-capability-unavailable",
          targetRuntime: "lambda",
          capability: "shutdown",
        },
      ],
    });
  });

  it("passes when the target runtime supports all required capabilities", async () => {
    const stdout: string[] = [];

    const exitCode = await runRuntimePolicyCheck(
      ["--manifest", "policy.json", "--target", "lambda"],
      {
        io: {
          cwd: "/workspace/app",
          readFile: () => JSON.stringify({ table: createPolicyTable(["flush", "waitUntil"]) }),
          stdout: (message) => stdout.push(message),
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toEqual(["Runtime policy check passed for 1 plan(s) against target 'lambda'."]);
  });
});

function createPolicyTable(requiredCapabilities: readonly RuntimeCapabilityName[]): PolicyTable {
  const target = {
    kind: "route",
    id: "WorkersController",
    operation: "create",
  } as const;

  return {
    plans: [
      {
        target,
        executionOrder: ["retry"],
        failurePropagation: [{ kind: "retry", failurePropagation: "retryable-operation-error" }],
        entries: [
          {
            target,
            policy: { kind: "retry", maxAttempts: 3 },
            order: 30,
            requiredCapabilities,
            failurePropagation: "retryable-operation-error",
          },
        ],
      },
    ],
  };
}
