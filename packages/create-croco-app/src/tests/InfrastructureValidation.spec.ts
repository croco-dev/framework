import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defineInfrastructureRequirements } from "@croco/framework-context";
import { validateInfrastructure } from "../infrastructure.js";
import type { InfrastructureProfile } from "../infrastructure.js";

const profiles: InfrastructureProfile[] = ["kubernetes", "aws-lambda", "cloudflare-workers"];
function fixture(profile: InfrastructureProfile) {
  return JSON.parse(
    readFileSync(new URL(`./fixtures/infrastructure/${profile}.json`, import.meta.url), "utf8"),
  );
}

describe.each(profiles)("%s infrastructure validation", (profile) => {
  it("accepts concrete required bindings and absent optional resources without claiming live verification", () => {
    expect(validateInfrastructure(fixture(profile))).toEqual({
      schemaVersion: "croco.infrastructure-validation/v1",
      ok: true,
      diagnostics: [],
      verification: "static-artifact-only",
      certification: "not-certified",
    });
  });
  it.each(["DB", "JOBS", "FILES", "TOKEN"])("rejects a missing %s binding", (id) => {
    const input = fixture(profile);
    input.bindings = input.bindings.filter(
      (binding: { requirement: string }) => binding.requirement !== id,
    );
    expect(validateInfrastructure(input)).toMatchObject({
      ok: false,
      diagnostics: [
        { code: "CROCO_INFRA_BINDING", requirement: ["DB", "JOBS", "FILES", "TOKEN"].indexOf(id) },
      ],
    });
  });
  it("checks optional bindings when selected and rejects stale/unrequired binding claims", () => {
    const input = fixture(profile);
    input.bindings.push({
      requirement: "OPTIONAL",
      resource: "MISSING",
      owner: "shop",
      scope: input.requirements.resources[0].scope,
    });
    expect(validateInfrastructure(input).diagnostics).toContainEqual({
      code: "CROCO_INFRA_BINDING",
      requirement: 4,
    });
    input.bindings[4].requirement = "UNNEEDED";
    expect(validateInfrastructure(input).diagnostics).toContainEqual({
      code: "CROCO_INFRA_BINDING",
    });
  });
  it("ignores unrelated native resources without treating them as a claim", () => {
    const input = fixture(profile);
    if (profile === "kubernetes")
      input.artifact.push({ kind: "Service", metadata: { name: "unused" } });
    else if (profile === "aws-lambda")
      input.artifact.Resources.Unused = { Type: "AWS::SQS::Queue" };
    else input.artifact.r2_buckets.push({ binding: "UNUSED", bucket_name: "unused" });
    expect(validateInfrastructure(input).ok).toBe(true);
  });
  it("rejects capability, runtime, owner, scope, duplicate and reference drift deterministically", () => {
    for (const change of [
      (input: ReturnType<typeof fixture>) => {
        input.requirements.runtimeCapabilities = ["filesystem"];
        input.requirements.runtime = "cloudflare-workers";
      },
      (input: ReturnType<typeof fixture>) => {
        input.requirements.resources[0].capabilities = ["dequeue"];
      },
      (input: ReturnType<typeof fixture>) => {
        input.bindings[0].owner = "other";
      },
      (input: ReturnType<typeof fixture>) => {
        input.bindings[0].scope = "other";
      },
      (input: ReturnType<typeof fixture>) => {
        input.bindings.push(input.bindings[0]);
      },
      (input: ReturnType<typeof fixture>) => {
        input.bindings[3].secretRef = "wrong-key";
      },
    ]) {
      const input = fixture(profile);
      change(input);
      const first = validateInfrastructure(input);
      expect(first.ok).toBe(false);
      expect(validateInfrastructure(input)).toEqual(first);
    }
  });
  it("does not leak raw artifacts or invalid schema values into its report", () => {
    const input = fixture(profile);
    input.requirements.resources[0].owner = "synthetic secret with spaces";
    const report = JSON.stringify(validateInfrastructure(input));
    expect(report).not.toContain("synthetic");
    expect(report).not.toContain("password");
    expect(report).toContain("CROCO_INFRA_SCHEMA");
  });
});

it("projects only reference fields into the neutral declaration", () => {
  const secret = {
    id: "TOKEN",
    kind: "secret",
    capabilities: ["read"],
    scope: "shop",
    owner: "shop",
    secretRef: "password",
    value: "never-copy-me",
  } as const;
  const declaration = defineInfrastructureRequirements({
    runtime: "node",
    runtimeCapabilities: ["env"],
    resources: [secret],
  });
  expect(JSON.stringify(declaration)).not.toContain("never-copy-me");
  expect(declaration.resources[0]?.secretRef).toBe("password");
});

it("rejects inherited profile names and missing schema without throwing", () => {
  const input = fixture("kubernetes");
  input.profile = "toString";
  expect(validateInfrastructure(input).diagnostics).toEqual([{ code: "CROCO_INFRA_SCHEMA" }]);
  expect(validateInfrastructure({} as never).ok).toBe(false);
});

it("rejects AWS wrong actions, broad/wrong ARN, deny, conditions, wrong kind and runtime", () => {
  for (const change of [
    (input: ReturnType<typeof fixture>) => {
      input.artifact.Resources.Api.Properties.Policies[0].Statement[1].Action = "sqs:DeleteMessage";
    },
    (input: ReturnType<typeof fixture>) => {
      input.artifact.Resources.Api.Properties.Policies[0].Statement[1].Resource = "*";
    },
    (input: ReturnType<typeof fixture>) => {
      input.artifact.Resources.Api.Properties.Policies[0].Statement[1].Resource = {
        "Fn::GetAtt": ["Other", "Arn"],
      };
    },
    (input: ReturnType<typeof fixture>) => {
      input.artifact.Resources.Api.Properties.Policies[0].Statement[1].Effect = "Deny";
    },
    (input: ReturnType<typeof fixture>) => {
      input.artifact.Resources.Api.Properties.Policies[0].Statement[1].Condition = {
        Bool: { enabled: true },
      };
    },
    (input: ReturnType<typeof fixture>) => {
      input.artifact.Resources.JOBS.Type = "AWS::S3::Bucket";
    },
    (input: ReturnType<typeof fixture>) => {
      input.artifact.Resources.Api.Properties.Runtime = "python3.12";
    },
  ]) {
    const input = fixture("aws-lambda");
    change(input);
    expect(validateInfrastructure(input).ok).toBe(false);
  }
});

it("validates CDK synthesized Lambda with the selected local role rather than another role", () => {
  const input = fixture("aws-lambda");
  const props = input.artifact.Resources.Api.Properties;
  input.artifact.Resources.Role = {
    Type: "AWS::IAM::Role",
    Properties: { Policies: [{ PolicyDocument: props.Policies[0] }] },
  };
  delete props.Policies;
  props.Role = { "Fn::GetAtt": ["Role", "Arn"] };
  input.artifact.Resources.Api.Type = "AWS::Lambda::Function";
  expect(validateInfrastructure(input).ok).toBe(true);
  props.Role = { "Fn::GetAtt": ["OtherRole", "Arn"] };
  expect(validateInfrastructure(input).ok).toBe(false);
});

it("rejects K8s namespace, secret key, optional injection and endpoint wiring errors", () => {
  for (const change of [
    (input: ReturnType<typeof fixture>) => {
      input.artifact[4].metadata.namespace = "other";
    },
    (input: ReturnType<typeof fixture>) => {
      delete input.artifact[4].stringData.password;
    },
    (input: ReturnType<typeof fixture>) => {
      input.artifact[0].spec.template.spec.containers[0].env[3].valueFrom.secretKeyRef.optional = true;
    },
    (input: ReturnType<typeof fixture>) => {
      input.artifact[0].spec.template.spec.containers[0].env[0].value =
        "another.shop.svc.cluster.local";
    },
  ]) {
    const input = fixture("kubernetes");
    change(input);
    expect(validateInfrastructure(input).ok).toBe(false);
  }
});

it("rejects missing native bindings, mistyped bindings and Worker execution configuration", () => {
  for (const change of [
    (input: ReturnType<typeof fixture>) => {
      input.artifact.queues.producers = [];
    },
    (input: ReturnType<typeof fixture>) => {
      input.artifact.r2_buckets[0].bucket_name = "";
    },
    (input: ReturnType<typeof fixture>) => {
      input.artifact.secrets_store_secrets[0].secret_name = "another-secret";
    },
    (input: ReturnType<typeof fixture>) => {
      input.artifact.main = "";
    },
  ]) {
    const input = fixture("cloudflare-workers");
    change(input);
    expect(validateInfrastructure(input).ok).toBe(false);
  }
});

it.each(profiles)(
  "rejects native resource deletion for %s even if binding claims remain",
  (profile) => {
    for (const index of [0, 1, 2, 3]) {
      const input = fixture(profile);
      if (profile === "kubernetes") input.artifact.splice(index + 1, 1);
      else if (profile === "aws-lambda")
        delete input.artifact.Resources[["DB", "JOBS", "FILES", "TOKEN"][index] ?? ""];
      else if (index === 0) input.artifact.d1_databases = [];
      else if (index === 1) input.artifact.queues.producers = [];
      else if (index === 2) input.artifact.r2_buckets = [];
      else input.artifact.secrets_store_secrets = [];
      expect(validateInfrastructure(input).diagnostics).toContainEqual({
        code: "CROCO_INFRA_BINDING",
        requirement: index,
      });
    }
  },
);

it("rejects conditional AWS resources and duplicate Kubernetes identities", () => {
  const aws = fixture("aws-lambda");
  aws.artifact.Resources.JOBS.Condition = "Maybe";
  expect(validateInfrastructure(aws).ok).toBe(false);
  const k8s = fixture("kubernetes");
  k8s.artifact.push(k8s.artifact[1]);
  expect(validateInfrastructure(k8s).ok).toBe(false);
});

it("rejects invalid native runtime fields and secret value types", () => {
  const aws = fixture("aws-lambda");
  aws.artifact.Resources.Api.Properties.Handler = "";
  expect(validateInfrastructure(aws).ok).toBe(false);
  const worker = fixture("cloudflare-workers");
  worker.artifact.compatibility_date = "2026-02-30";
  expect(validateInfrastructure(worker).ok).toBe(false);
  const k8s = fixture("kubernetes");
  k8s.artifact[4].stringData.password = { wrong: "type" };
  expect(validateInfrastructure(k8s).ok).toBe(false);
});

it.each(profiles)("accepts a supplied valid optional resource for %s", (profile) => {
  const input = fixture(profile);
  const storage = input.requirements.resources[2];
  input.requirements.resources[4] = { ...storage, id: "OPTIONAL", optional: true };
  input.bindings.push({ ...input.bindings[2], requirement: "OPTIONAL" });
  expect(validateInfrastructure(input).ok).toBe(true);
});

it.each(["DB_HOST", "API_TOKEN"])(
  "rejects duplicate Kubernetes environment wiring for %s",
  (name) => {
    const input = fixture("kubernetes");
    const env = input.artifact[0].spec.template.spec.containers[0].env;
    env.push({ name, value: "another-endpoint.example.test" });
    expect(validateInfrastructure(input).diagnostics).toContainEqual({
      code: "CROCO_INFRA_RUNTIME",
    });
  },
);

it("rejects unnamed or conflicting Kubernetes Secret environment sources", () => {
  for (const malformed of ["unnamed", "two-sources"]) {
    const input = fixture("kubernetes");
    const secret = input.artifact[0].spec.template.spec.containers[0].env[3];
    if (malformed === "unnamed") delete secret.name;
    else secret.value = "literal-overrides-reference";
    expect(validateInfrastructure(input).diagnostics).toContainEqual({
      code: "CROCO_INFRA_RUNTIME",
    });
  }
});

it.each(["fieldRef", "configMapKeyRef"])(
  "rejects competing Kubernetes %s and Secret sources",
  (field) => {
    const input = fixture("kubernetes");
    input.artifact[0].spec.template.spec.containers[0].env[3].valueFrom[field] = {
      name: "other",
      key: "password",
      fieldPath: "metadata.name",
    };
    expect(validateInfrastructure(input).diagnostics).toContainEqual({
      code: "CROCO_INFRA_RUNTIME",
    });
  },
);

it.each(["NotAction", "NotResource"])("rejects conflicting IAM %s selectors", (field) => {
  const input = fixture("aws-lambda");
  input.artifact.Resources.Api.Properties.Policies[0].Statement[0][field] =
    field === "NotAction" ? "dynamodb:DeleteItem" : "*";
  expect(validateInfrastructure(input).diagnostics).toContainEqual({
    code: "CROCO_INFRA_PERMISSION",
    requirement: 0,
  });
});

it("checks object-shaped inline IAM statements, including their deny semantics", () => {
  const input = fixture("aws-lambda");
  const props = input.artifact.Resources.Api.Properties;
  props.Policies = props.Policies[0].Statement.map((statement: unknown) => ({
    Version: "2012-10-17",
    Statement: statement,
  }));
  expect(validateInfrastructure(input).ok).toBe(true);
  props.Policies[0].Statement.Effect = "Deny";
  expect(validateInfrastructure(input).ok).toBe(false);
});

it("accepts typed IAM selector arrays but rejects malformed elements", () => {
  const input = fixture("aws-lambda");
  const statement = input.artifact.Resources.Api.Properties.Policies[0].Statement[0];
  statement.Action = [statement.Action];
  statement.Resource = [statement.Resource];
  expect(validateInfrastructure(input).ok).toBe(true);
  statement.Action.push(42);
  expect(validateInfrastructure(input).ok).toBe(false);
  statement.Action.pop();
  statement.Resource.push({ UnsupportedIntrinsic: "other-resource" });
  expect(validateInfrastructure(input).ok).toBe(false);
});

it("rejects non-boolean Secret optional selectors", () => {
  const input = fixture("kubernetes");
  input.artifact[0].spec.template.spec.containers[0].env[3].valueFrom.secretKeyRef.optional =
    "false";
  expect(validateInfrastructure(input).ok).toBe(false);
});

it.each([{ Ref: "TOKEN" }, { "Fn::GetAtt": ["TOKEN", "Id"] }])(
  "accepts native Secrets Manager ARN reference %j",
  (reference) => {
    const input = fixture("aws-lambda");
    input.artifact.Resources.Api.Properties.Policies[0].Statement[3].Resource = reference;
    expect(validateInfrastructure(input).ok).toBe(true);
  },
);

it("rejects the nonexistent Secrets Manager Arn attribute and another secret reference", () => {
  for (const reference of [{ "Fn::GetAtt": ["TOKEN", "Arn"] }, { Ref: "OTHER" }]) {
    const input = fixture("aws-lambda");
    input.artifact.Resources.Api.Properties.Policies[0].Statement[3].Resource = reference;
    expect(validateInfrastructure(input).diagnostics).toContainEqual({
      code: "CROCO_INFRA_PERMISSION",
      requirement: 3,
    });
  }
});

it.each([
  ["kv_namespaces", [{ binding: "DB", id: "existing" }]],
  ["services", [{ binding: "DB", service: "existing" }]],
  ["browser", { binding: "DB" }],
  ["durable_objects", { bindings: [{ name: "DB", class_name: "Existing" }] }],
  ["unsafe", { bindings: [{ name: "DB", type: "plain_text", text: "existing" }] }],
  ["text_blobs", { DB: "existing.txt" }],
])("rejects a claimed Wrangler name colliding with %s", (section, value) => {
  const input = fixture("cloudflare-workers");
  input.artifact[String(section)] = value;
  expect(validateInfrastructure(input).diagnostics).toContainEqual({
    code: "CROCO_INFRA_BINDING",
    requirement: 0,
  });
  input.artifact[String(section)] =
    section === "kv_namespaces" ? [{ binding: "UNUSED", id: "existing" }] : undefined;
  expect(validateInfrastructure(input).ok).toBe(true);
});
