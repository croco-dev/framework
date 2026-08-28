import { defineCommand } from "citty";
import {
  DEFAULT_TOKEN_HEADER,
  formatOpsStatusReport,
  getOpsStatusExitCode,
  parseOpsTimeoutMs,
  runOpsCheck,
  runOpsStatus,
} from "../libs/ops.js";
import { GLOBAL_OPTIONS } from "./options.js";
import { getCrocoCommandRuntime } from "../libs/cliRuntime.js";

export {
  formatOpsStatusReport,
  getOpsStatusExitCode,
  runOpsCheck,
  runOpsStatus,
} from "../libs/ops.js";

export type {
  OpsEndpointName,
  OpsEndpointSnapshot,
  OpsStatusFetch,
  OpsStatusReport,
  OpsStatusSummary,
  RunOpsStatusOptions,
} from "../libs/ops.js";

export const opsStatus = defineCommand({
  meta: {
    name: "status",
    description: "Read Croco operational endpoints",
  },
  args: {
    ...GLOBAL_OPTIONS,
    url: {
      type: "positional",
      required: true,
      description: "Croco app base URL",
    },
    json: {
      type: "boolean",
      description: "Print the machine-readable status report",
    },
    token: {
      type: "string",
      description: "Diagnostics token",
    },
    tokenHeader: {
      type: "string",
      default: DEFAULT_TOKEN_HEADER,
      description: "Diagnostics token header",
    },
    timeout: {
      type: "string",
      description: "Per-endpoint timeout in milliseconds",
    },
  },
  async run({ args }) {
    const report = await runOpsStatus(String(args.url ?? ""), {
      token: typeof args.token === "string" ? args.token : undefined,
      tokenHeader: typeof args.tokenHeader === "string" ? args.tokenHeader : DEFAULT_TOKEN_HEADER,
      timeoutMs: parseOpsTimeoutMs(args.timeout),
    });

    getCrocoCommandRuntime().stdout(
      args.json ? JSON.stringify(report, null, 2) : formatOpsStatusReport(report),
    );
    getCrocoCommandRuntime().setExitCode(getOpsStatusExitCode(report.summary));
  },
});

export const opsCheck = defineCommand({
  meta: {
    name: "check",
    description: "Check Croco operational endpoints for CI",
  },
  args: {
    ...GLOBAL_OPTIONS,
    url: {
      type: "positional",
      required: true,
      description: "Croco app base URL",
    },
    json: {
      type: "boolean",
      description: "Print the machine-readable check report",
    },
    metrics: {
      type: "boolean",
      description: "Also check the optional /metrics endpoint",
    },
    token: {
      type: "string",
      description: "Diagnostics token",
    },
    tokenHeader: {
      type: "string",
      default: DEFAULT_TOKEN_HEADER,
      description: "Diagnostics token header",
    },
    timeout: {
      type: "string",
      description: "Per-endpoint timeout in milliseconds",
    },
  },
  async run({ args }) {
    const report = await runOpsCheck(String(args.url ?? ""), {
      includeMetrics: Boolean(args.metrics),
      token: typeof args.token === "string" ? args.token : undefined,
      tokenHeader: typeof args.tokenHeader === "string" ? args.tokenHeader : DEFAULT_TOKEN_HEADER,
      timeoutMs: parseOpsTimeoutMs(args.timeout),
    });

    getCrocoCommandRuntime().stdout(
      args.json ? JSON.stringify(report, null, 2) : formatOpsStatusReport(report),
    );
    getCrocoCommandRuntime().setExitCode(getOpsStatusExitCode(report.summary));
  },
});

export const ops = defineCommand({
  meta: {
    name: "ops",
    description: "Inspect Croco operational endpoints",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  subCommands: {
    check: opsCheck,
    status: opsStatus,
  },
});
