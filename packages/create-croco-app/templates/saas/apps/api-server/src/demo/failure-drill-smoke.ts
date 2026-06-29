import {
  createFailureDrillCatalog,
  runFailureDrills,
  type FailureDrillRunOutput,
} from "@croco/testing";
import { ProblemCategory, ProblemCategoryMapper, type ProblemDetails } from "@croco/problems-core";
import { runSaasDemoFlow } from "../saasDemo";
import { assertSaasSmokeContract } from "./saasSmokeContract";

const WEBHOOK_DUPLICATE_RECOVERY =
  "Return the stored idempotent outcome and suppress duplicate side effects.";
const QUOTA_EXCEEDED_RECOVERY =
  "Reject the request and direct the tenant to reduce usage or upgrade.";

function createProblemDetails(
  code: string,
  category: ProblemCategory,
  detail: string,
  recoveryAction: string,
): ProblemDetails {
  return {
    code,
    detail,
    recoveryAction,
    status: ProblemCategoryMapper.toHttpStatus(category),
    title: ProblemCategoryMapper.toTitle(category),
    type: "about:blank",
  };
}

async function main(): Promise<void> {
  const snapshot = await runSaasDemoFlow();
  assertSaasSmokeContract(snapshot);

  const catalog = createFailureDrillCatalog({
    "webhook-duplicate": {
      description:
        "Uses the generated lifecycle duplicate run to prove duplicate deliveries keep idempotency evidence.",
      expected: {
        evidence: {
          audit: "saas.lifecycle.duplicate_skipped",
          telemetry: "saas.lifecycle.duplicate_delivery",
        },
        problem: {
          code: "testing/webhook-duplicate-delivery",
          status: 409,
          title: "Conflict",
        },
        recoveryAction: WEBHOOK_DUPLICATE_RECOVERY,
      },
      name: "SaaS lifecycle duplicate delivery",
      run: (): FailureDrillRunOutput => ({
        evidence: [
          {
            attributes: {
              emittedActionCount: snapshot.lifecycle.emittedActionCount,
              ruleId: snapshot.lifecycle.ruleId,
              status: snapshot.lifecycle.duplicateRunStatus,
            },
            kind: "telemetry",
            name: "saas.lifecycle.duplicate_delivery",
          },
          {
            attributes: {
              skipReason: snapshot.lifecycle.duplicateSkipReason,
              visibleRunCount: snapshot.lifecycle.visibleRunCount,
            },
            kind: "audit",
            name: "saas.lifecycle.duplicate_skipped",
          },
          {
            attributes: {
              skipReason: snapshot.lifecycle.duplicateSkipReason,
            },
            kind: "idempotency",
            name: "saas.lifecycle.idempotency_key_reused",
          },
        ],
        problem: createProblemDetails(
          "testing/webhook-duplicate-delivery",
          ProblemCategory.Conflict,
          `Lifecycle duplicate delivery was ${snapshot.lifecycle.duplicateRunStatus}: ${snapshot.lifecycle.duplicateSkipReason}.`,
          WEBHOOK_DUPLICATE_RECOVERY,
        ),
        recoveryAction: WEBHOOK_DUPLICATE_RECOVERY,
      }),
    },
    "quota-exceeded": {
      description:
        "Uses the generated LLM metering quota path to prove quota failures expose Problem and evidence.",
      expected: {
        evidence: {
          audit: "saas.metering.quota_rejected",
          telemetry: "saas.llm.quota_exceeded",
        },
        problem: {
          code: "llm-metering/quota-exceeded",
          status: 403,
          title: "Forbidden",
        },
        recoveryAction: QUOTA_EXCEEDED_RECOVERY,
      },
      name: "SaaS LLM quota exceeded",
      run: (): FailureDrillRunOutput => ({
        evidence: [
          {
            attributes: {
              meterId: "llm.prompt_tokens",
              promptQuota: snapshot.ai.promptQuota,
              promptUsage: snapshot.ai.promptUsage,
            },
            kind: "telemetry",
            name: "saas.llm.quota_exceeded",
          },
          {
            attributes: {
              problemCode: snapshot.ai.quotaFailureCode,
              tenantId: snapshot.tenant.id,
            },
            kind: "audit",
            name: "saas.metering.quota_rejected",
          },
        ],
        problem: createProblemDetails(
          snapshot.ai.quotaFailureCode,
          ProblemCategory.Forbidden,
          `LLM prompt quota ${snapshot.ai.promptQuota} rejected excess usage for ${snapshot.tenant.id}.`,
          QUOTA_EXCEEDED_RECOVERY,
        ),
        recoveryAction: QUOTA_EXCEEDED_RECOVERY,
      }),
    },
  });
  const report = await runFailureDrills(catalog);

  console.log(`SaaS failure drill smoke passed (${report.results.length} drills)`);
}

void main();
