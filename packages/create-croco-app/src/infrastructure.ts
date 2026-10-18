import { RUNTIME_CAPABILITY_NAMES, RUNTIME_CAPABILITY_SUPPORT } from "@croco/framework-context";
import type {
  InfrastructureRequirements,
  InfrastructureCapability,
} from "@croco/framework-context";

export type InfrastructureProfile = "kubernetes" | "aws-lambda" | "cloudflare-workers";

/** Each locator is scoped to one workload, resource and application owner. */
export type InfrastructureBinding = {
  readonly requirement: string;
  readonly owner: string;
  readonly scope: string;
  readonly resource: string;
  /** Secret key for Kubernetes; exact native secret locator for AWS/Cloudflare. */
  readonly secretRef?: string;
  /** K8s Service endpoint variable in the selected container. */
  readonly env?: string;
};

export type InfrastructureValidationInput = {
  readonly profile: InfrastructureProfile;
  readonly requirements: InfrastructureRequirements;
  readonly bindings: readonly InfrastructureBinding[];
  /** K8s Deployment name, SAM/CF Lambda logical id, or Wrangler worker name. */
  readonly workload: string;
  /** Parsed Kubernetes List/array, synthesized SAM/CloudFormation, or Wrangler config. */
  readonly artifact: unknown;
};

export const INFRASTRUCTURE_DIAGNOSTIC_CODES = {
  schema: "CROCO_INFRA_SCHEMA",
  runtime: "CROCO_INFRA_RUNTIME",
  binding: "CROCO_INFRA_BINDING",
  kind: "CROCO_INFRA_KIND",
  permission: "CROCO_INFRA_PERMISSION",
  secret: "CROCO_INFRA_SECRET",
} as const;

export type InfrastructureDiagnostic = {
  readonly code: (typeof INFRASTRUCTURE_DIAGNOSTIC_CODES)[keyof typeof INFRASTRUCTURE_DIAGNOSTIC_CODES];
  /** Array index, never untrusted contents or secret values. */
  readonly requirement?: number;
};

export type InfrastructureValidationReport = {
  readonly schemaVersion: "croco.infrastructure-validation/v1";
  readonly ok: boolean;
  readonly diagnostics: readonly InfrastructureDiagnostic[];
  readonly verification: "static-artifact-only";
  readonly certification: "not-certified";
};

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as ObjectValue)
    : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const strings = (value: unknown): string[] =>
  typeof value === "string"
    ? [value]
    : list(value).filter((item): item is string => typeof item === "string");
const name = (value: unknown): boolean =>
  typeof value === "string" && /^[a-zA-Z0-9_./:@-]{1,200}$/.test(value);
const INFRASTRUCTURE_KINDS = ["database", "queue", "storage", "secret"];
const INFRASTRUCTURE_CAPABILITIES = ["connect", "read", "write", "enqueue", "dequeue"];
const PROFILE_PLATFORMS = {
  kubernetes: "node",
  "aws-lambda": "lambda",
  "cloudflare-workers": "cloudflare-workers",
} as const;

/** Fail closed on unsupported artifact shapes. Never includes input contents in the report. */
export function validateInfrastructure(
  input: InfrastructureValidationInput,
): InfrastructureValidationReport {
  const diagnostics: InfrastructureDiagnostic[] = [];
  const add = (code: InfrastructureDiagnostic["code"], requirement?: number): void => {
    diagnostics.push({ code, ...(requirement === undefined ? {} : { requirement }) });
  };
  const raw = object(input);
  const req = object(raw["requirements"]);
  const profile = raw["profile"];
  const resources = list(req["resources"]);
  const bindings = list(raw["bindings"]).map(object);
  if (
    !(typeof profile === "string" && Object.hasOwn(PROFILE_PLATFORMS, profile)) ||
    !name(raw["workload"]) ||
    req["schemaVersion"] !== "croco.infrastructure-requirements/v1" ||
    !Array.isArray(req["resources"]) ||
    !Array.isArray(req["runtimeCapabilities"]) ||
    !Array.isArray(raw["bindings"])
  ) {
    add("CROCO_INFRA_SCHEMA");
    return report(diagnostics);
  }
  const selected = profile as InfrastructureProfile;
  const runtime = PROFILE_PLATFORMS[selected];
  if (req["runtime"] !== runtime) add("CROCO_INFRA_RUNTIME");
  for (const capability of list(req["runtimeCapabilities"])) {
    if (!RUNTIME_CAPABILITY_NAMES.some((known) => known === capability)) add("CROCO_INFRA_SCHEMA");
    else if (
      !RUNTIME_CAPABILITY_SUPPORT[runtime][
        capability as keyof (typeof RUNTIME_CAPABILITY_SUPPORT)[typeof runtime]
      ]
    )
      add("CROCO_INFRA_RUNTIME");
  }
  const artifact = object(raw["artifact"]);
  if (selected === "cloudflare-workers" && Object.keys(object(artifact["env"])).length > 0)
    add("CROCO_INFRA_SCHEMA");
  const workload = String(raw["workload"]);
  const nativeResources =
    selected === "kubernetes"
      ? list(Array.isArray(raw["artifact"]) ? raw["artifact"] : artifact["items"]).map(object)
      : [];
  const awsResources = object(artifact["Resources"]);
  const nativeWorkload =
    selected === "kubernetes"
      ? nativeResources.find(
          (resource) =>
            resource["kind"] === "Deployment" && object(resource["metadata"])["name"] === workload,
        )
      : selected === "aws-lambda"
        ? object(awsResources[workload])
        : artifact;
  if (
    selected === "kubernetes" &&
    nativeResources.filter(
      (resource) =>
        resource["kind"] === "Deployment" && object(resource["metadata"])["name"] === workload,
    ).length !== 1
  )
    add("CROCO_INFRA_RUNTIME");
  if (!nativeWorkload || !validWorkload(selected, nativeWorkload, workload))
    add("CROCO_INFRA_RUNTIME");
  const ids = resources.map((entry) => object(entry)["id"]);
  const seen = new Set<unknown>();
  resources.forEach((entry, index) => {
    const resource = object(entry);
    if (
      !name(resource["id"]) ||
      !name(resource["owner"]) ||
      !name(resource["scope"]) ||
      seen.has(resource["id"]) ||
      !INFRASTRUCTURE_KINDS.includes(String(resource["kind"])) ||
      !Array.isArray(resource["capabilities"]) ||
      list(resource["capabilities"]).length === 0 ||
      list(resource["capabilities"]).some(
        (cap) => !INFRASTRUCTURE_CAPABILITIES.includes(String(cap)),
      ) ||
      (resource["optional"] !== undefined && typeof resource["optional"] !== "boolean") ||
      (resource["secretRef"] !== undefined && !name(resource["secretRef"]))
    ) {
      add("CROCO_INFRA_SCHEMA", index);
      return;
    }
    seen.add(resource["id"]);
    const matches = bindings.filter((binding) => binding["requirement"] === resource["id"]);
    if (matches.length === 0 && resource["optional"] === true) return;
    if (matches.length !== 1) {
      add("CROCO_INFRA_BINDING", index);
      return;
    }
    const binding = matches[0];
    if (
      !binding ||
      binding["owner"] !== resource["owner"] ||
      binding["scope"] !== resource["scope"] ||
      !name(binding["resource"])
    ) {
      add("CROCO_INFRA_BINDING", index);
      return;
    }
    if (
      resource["kind"] === "secret" &&
      (resource["secretRef"] === undefined || binding["secretRef"] !== resource["secretRef"])
    ) {
      add("CROCO_INFRA_SECRET", index);
      return;
    }
    const result =
      selected === "kubernetes"
        ? kubernetes(resource, binding, nativeResources, nativeWorkload ?? {})
        : selected === "aws-lambda"
          ? aws(resource, binding, awsResources, nativeWorkload ?? {}, workload)
          : cloudflare(resource, binding, artifact);
    for (const code of result) add(code, index);
  });
  if (bindings.some((binding) => !ids.includes(binding["requirement"]))) add("CROCO_INFRA_BINDING");
  return report(diagnostics);
}

function report(diagnostics: InfrastructureDiagnostic[]): InfrastructureValidationReport {
  return {
    schemaVersion: "croco.infrastructure-validation/v1",
    ok: diagnostics.length === 0,
    diagnostics,
    verification: "static-artifact-only",
    certification: "not-certified",
  };
}

function validWorkload(profile: InfrastructureProfile, workload: ObjectValue, id: string): boolean {
  if (profile === "cloudflare-workers")
    return (
      workload["name"] === id &&
      typeof workload["main"] === "string" &&
      name(workload["main"]) &&
      validDate(workload["compatibility_date"])
    );
  if (profile === "aws-lambda") {
    const props = object(workload["Properties"]);
    return (
      workload["Condition"] === undefined &&
      ["AWS::Serverless::Function", "AWS::Lambda::Function"].includes(String(workload["Type"])) &&
      /^nodejs(22|24)\.x$/.test(String(props["Runtime"])) &&
      name(props["Handler"]) &&
      /^.+\.[^.]+$/.test(String(props["Handler"]))
    );
  }
  const containers = list(
    object(object(object(workload["spec"])["template"])["spec"])["containers"],
  );
  return (
    workload["apiVersion"] === "apps/v1" &&
    containers.length === 1 &&
    containers.every((entry) => {
      const container = object(entry);
      const environment = list(container["env"]).map(object);
      const names = environment.map((variable) => variable["name"]);
      return (
        typeof container["image"] === "string" &&
        /^[a-zA-Z0-9][a-zA-Z0-9._/:@-]*$/.test(container["image"]) &&
        (container["env"] === undefined || Array.isArray(container["env"])) &&
        names.every((variable) => typeof variable === "string" && variable.length > 0) &&
        new Set(names).size === names.length &&
        environment.every(
          (variable) =>
            (variable["value"] === undefined || variable["valueFrom"] === undefined) &&
            validEnvironmentSource(variable["valueFrom"]),
        )
      );
    })
  );
}

type Codes = InfrastructureDiagnostic["code"][];
function supports(resource: ObjectValue, provided: readonly string[]): boolean {
  return list(resource["capabilities"]).every((capability) =>
    provided.includes(String(capability)),
  );
}

function kubernetes(
  resource: ObjectValue,
  binding: ObjectValue,
  resources: ObjectValue[],
  workload: ObjectValue,
): Codes {
  const found = resources.filter(
    (candidate) =>
      object(candidate["metadata"])["name"] === binding["resource"] &&
      (object(candidate["metadata"])["namespace"] ?? "default") === binding["scope"],
  );
  const expectedKind = resource["kind"] === "secret" ? "Secret" : "Service";
  const candidates = found.filter((candidate) => candidate["kind"] === expectedKind);
  if (candidates.length !== 1) return ["CROCO_INFRA_BINDING"];
  const target = candidates[0];
  if (!target) return ["CROCO_INFRA_BINDING"];
  if (target["apiVersion"] !== "v1") return ["CROCO_INFRA_KIND"];
  if ((object(workload["metadata"])["namespace"] ?? "default") !== binding["scope"])
    return ["CROCO_INFRA_BINDING"];
  const pod = object(object(object(workload["spec"])["template"])["spec"]);
  const containers = list(pod["containers"]).map(object);
  if (resource["kind"] === "secret") {
    // A mounted exact key is the workload's permission declaration. RBAC is not needed for env injection.
    const wired = containers.some((container) =>
      list(container["env"]).some((entry) => {
        const ref = object(object(object(entry)["valueFrom"])["secretKeyRef"]);
        return (
          ref["name"] === binding["resource"] &&
          ref["key"] === binding["secretRef"] &&
          ref["optional"] !== true
        );
      }),
    );
    const keys = object(target["data"]);
    const stringKeys = object(target["stringData"]);
    if (
      !wired ||
      !(
        (Object.hasOwn(keys, String(binding["secretRef"])) &&
          typeof keys[String(binding["secretRef"])] === "string") ||
        (Object.hasOwn(stringKeys, String(binding["secretRef"])) &&
          typeof stringKeys[String(binding["secretRef"])] === "string")
      )
    )
      return ["CROCO_INFRA_SECRET"];
    return supports(resource, ["read"]) ? [] : ["CROCO_INFRA_PERMISSION"];
  }
  // Service existence proves connectivity configuration only, never database/queue/storage operations.
  const wired = containers.some((container) =>
    list(container["env"]).some((entry) => {
      const env = object(entry);
      return (
        name(binding["env"]) &&
        env["name"] === binding["env"] &&
        env["value"] ===
          `${String(binding["resource"])}.${String(binding["scope"])}.svc.cluster.local`
      );
    }),
  );
  if (!wired) return ["CROCO_INFRA_BINDING"];
  const ports = list(object(target["spec"])["ports"]);
  if (
    !ports.length ||
    ports.some(
      (port) =>
        !Number.isInteger(object(port)["port"]) ||
        Number(object(port)["port"]) < 1 ||
        Number(object(port)["port"]) > 65535,
    )
  )
    return ["CROCO_INFRA_KIND"];
  return supports(resource, ["connect"]) ? [] : ["CROCO_INFRA_PERMISSION"];
}

const AWS_RESOURCE_KINDS: Record<
  string,
  { kind: string; actions: Partial<Record<InfrastructureCapability, string>> }
> = {
  "AWS::SQS::Queue": {
    kind: "queue",
    actions: { enqueue: "sqs:SendMessage", dequeue: "sqs:ReceiveMessage" },
  },
  "AWS::S3::Bucket": { kind: "storage", actions: { read: "s3:GetObject", write: "s3:PutObject" } },
  "AWS::DynamoDB::Table": {
    kind: "database",
    actions: { read: "dynamodb:GetItem", write: "dynamodb:PutItem" },
  },
  "AWS::SecretsManager::Secret": {
    kind: "secret",
    actions: { read: "secretsmanager:GetSecretValue" },
  },
};

function aws(
  resource: ObjectValue,
  binding: ObjectValue,
  resources: ObjectValue,
  workload: ObjectValue,
  workloadId: string,
): Codes {
  const target = Object.hasOwn(resources, String(binding["resource"]))
    ? object(resources[String(binding["resource"])])
    : {};
  if (!target["Type"]) return ["CROCO_INFRA_BINDING"];
  const contract = AWS_RESOURCE_KINDS[String(target["Type"])];
  if (target["Condition"] !== undefined) return ["CROCO_INFRA_BINDING"];
  if (!contract || contract.kind !== resource["kind"]) return ["CROCO_INFRA_KIND"];
  const props = object(workload["Properties"]);
  // Minimal supported policy form: inline SAM statements, or an exact local IAM role's inline policy.
  if (binding["scope"] !== workloadId) return ["CROCO_INFRA_BINDING"];
  const roleRef = list(object(props["Role"])["Fn::GetAtt"]);
  const role = roleRef[1] === "Arn" ? object(resources[String(roleRef[0])]) : {};
  if (
    props["Role"] !== undefined &&
    (role["Type"] !== "AWS::IAM::Role" || role["Condition"] !== undefined)
  )
    return ["CROCO_INFRA_PERMISSION"];
  const policyDocs =
    workload["Type"] === "AWS::Serverless::Function" && props["Role"] === undefined
      ? list(props["Policies"]).map(object)
      : list(object(role["Properties"])["Policies"]).map((policy) =>
          object(object(policy)["PolicyDocument"]),
        );
  if (
    policyDocs.some(
      (policy) =>
        policy["Statement"] === undefined ||
        (policy["Version"] !== undefined &&
          !["2012-10-17", "2008-10-17"].includes(String(policy["Version"]))) ||
        (policy["Id"] !== undefined && typeof policy["Id"] !== "string") ||
        Object.keys(policy).some((key) => !["Version", "Id", "Statement"].includes(key)),
    )
  )
    return ["CROCO_INFRA_PERMISSION"];
  const statements = policyDocs
    .flatMap((policy) =>
      Array.isArray(policy["Statement"]) ? policy["Statement"] : [policy["Statement"]],
    )
    .map(object);
  if (statements.some((statement) => !validPermissionStatement(statement)))
    return ["CROCO_INFRA_PERMISSION"];
  const exactArn = { "Fn::GetAtt": [binding["resource"], "Arn"] };
  const objectArn = { "Fn::Join": ["", [exactArn, "/*"]] };
  const requiredArns =
    resource["kind"] === "secret"
      ? [{ Ref: binding["resource"] }, { "Fn::GetAtt": [binding["resource"], "Id"] }]
      : [resource["kind"] === "storage" ? objectArn : exactArn];
  const equal = (left: unknown, right: unknown): boolean =>
    JSON.stringify(left) === JSON.stringify(right);
  const covers = (statement: ObjectValue): boolean => {
    const value = statement["Resource"];
    return requiredArns.some(
      (requiredArn) =>
        equal(value, requiredArn) || list(value).some((arn) => equal(arn, requiredArn)),
    );
  };
  if (resource["kind"] === "secret" && binding["secretRef"] !== binding["resource"])
    return ["CROCO_INFRA_SECRET"];
  for (const capability of list(resource["capabilities"])) {
    const action = contract.actions[capability as InfrastructureCapability];
    if (
      !action ||
      statements.some((statement) => statement["Effect"] === "Deny") ||
      !statements.some(
        (statement) =>
          statement["Effect"] === "Allow" &&
          statement["Condition"] === undefined &&
          strings(statement["Action"]).includes(action) &&
          covers(statement),
      )
    )
      return ["CROCO_INFRA_PERMISSION"];
  }
  return [];
}

function cloudflare(resource: ObjectValue, binding: ObjectValue, artifact: ObjectValue): Codes {
  // Native binding presence supplies only its documented static capability subset.
  const entries: { value: ObjectValue; kind: string; caps: string[]; locator: string }[] = [
    ...list(artifact["r2_buckets"]).map((entry) => ({
      value: object(entry),
      kind: "storage",
      caps: ["read", "write"],
      locator: "bucket_name",
    })),
    ...list(artifact["d1_databases"]).map((entry) => ({
      value: object(entry),
      kind: "database",
      caps: ["read", "write"],
      locator: "database_id",
    })),
    ...list(object(artifact["queues"])["producers"]).map((entry) => ({
      value: object(entry),
      kind: "queue",
      caps: ["enqueue"],
      locator: "queue",
    })),
    ...list(artifact["secrets_store_secrets"]).map((entry) => ({
      value: object(entry),
      kind: "secret",
      caps: ["read"],
      locator: "secret_name",
    })),
  ];
  if (Object.hasOwn(object(artifact["vars"]), String(binding["resource"])))
    return ["CROCO_INFRA_KIND"];
  const nativeNames = Object.entries(artifact).flatMap(([section, value]) => {
    if (["vars", "wasm_modules", "text_blobs", "data_blobs"].includes(section))
      return Object.keys(object(value));
    if (Array.isArray(value)) return value.map((entry) => object(entry)["binding"]);
    const config = object(value);
    return [
      config["binding"],
      ...list(config["bindings"]).map((entry) => object(entry)["name"] ?? object(entry)["binding"]),
      ...list(config["producers"]).map((entry) => object(entry)["binding"]),
    ];
  });
  if (nativeNames.filter((name) => name === binding["resource"]).length !== 1)
    return ["CROCO_INFRA_BINDING"];
  const found = entries.filter((entry) => entry.value["binding"] === binding["resource"]);
  if (found.length !== 1) return ["CROCO_INFRA_BINDING"];
  const entry = found[0];
  if (!entry || entry.kind !== resource["kind"]) return ["CROCO_INFRA_KIND"];
  if (binding["scope"] !== artifact["name"] || !name(entry.value[entry.locator]))
    return ["CROCO_INFRA_BINDING"];
  if (
    resource["kind"] === "secret" &&
    (entry.value["secret_name"] !== binding["secretRef"] || !name(entry.value["store_id"]))
  )
    return ["CROCO_INFRA_SECRET"];
  return supports(resource, entry.caps) ? [] : ["CROCO_INFRA_PERMISSION"];
}

function validDate(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validEnvironmentSource(value: unknown): boolean {
  if (value === undefined) return true;
  const source = object(value);
  const fields = Object.keys(source);
  const field = fields[0];
  if (fields.length !== 1 || field === undefined) return false;
  const reference = object(source[field]);
  if (source[field] === null || typeof source[field] !== "object" || Array.isArray(source[field]))
    return false;
  if (field === "secretKeyRef" || field === "configMapKeyRef") {
    return (
      name(reference["name"]) &&
      name(reference["key"]) &&
      (reference["optional"] === undefined || typeof reference["optional"] === "boolean")
    );
  }
  if (field === "fieldRef") {
    if (reference["apiVersion"] !== undefined && reference["apiVersion"] !== "v1") return false;
    const path = reference["fieldPath"];
    if (typeof path !== "string") return false;
    if (
      [
        "metadata.name",
        "metadata.namespace",
        "metadata.uid",
        "spec.nodeName",
        "spec.serviceAccountName",
        "status.hostIP",
        "status.hostIPs",
        "status.podIP",
        "status.podIPs",
      ].includes(path)
    )
      return true;
    const match = /^metadata\.(labels|annotations)\['([^']+)'\]$/.exec(path);
    const key = match?.[2];
    if (!key) return false;
    const parts = key.split("/");
    const suffix = parts.at(-1) ?? "";
    const prefix = parts.length === 2 ? (parts[0] ?? "") : undefined;
    return (
      parts.length <= 2 &&
      suffix.length <= 63 &&
      /^[a-zA-Z0-9]([a-zA-Z0-9_.-]*[a-zA-Z0-9])?$/.test(suffix) &&
      (prefix === undefined ||
        (prefix.length <= 253 &&
          prefix
            .split(".")
            .every((part) => part.length <= 63 && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(part))))
    );
  }
  if (field === "resourceFieldRef") return name(reference["resource"]);
  return false;
}

function validPermissionStatement(statement: ObjectValue): boolean {
  const action = statement["Action"];
  const actions = typeof action === "string" ? [action] : list(action);
  const resource = statement["Resource"];
  const resources = Array.isArray(resource) ? resource : [resource];
  return (
    Object.keys(statement).every((field) =>
      ["Sid", "Effect", "Action", "Resource"].includes(field),
    ) &&
    statement["Effect"] === "Allow" &&
    (statement["Sid"] === undefined || typeof statement["Sid"] === "string") &&
    actions.length > 0 &&
    actions.every((entry) => typeof entry === "string" && entry.length > 0) &&
    resources.length > 0 &&
    resources.every(isSupportedArn)
  );
}

function isSupportedArn(value: unknown): boolean {
  if (typeof value === "string") return value.length > 0;
  const arn = object(value);
  if (Object.keys(arn).length !== 1) return false;
  if (name(arn["Ref"])) return true;
  const attribute = list(arn["Fn::GetAtt"]);
  if (attribute.length === 2 && name(attribute[0]) && ["Arn", "Id"].includes(String(attribute[1])))
    return true;
  const join = list(arn["Fn::Join"]);
  const parts = list(join[1]);
  return (
    join.length === 2 &&
    join[0] === "" &&
    parts.length === 2 &&
    parts[1] === "/*" &&
    Object.hasOwn(object(parts[0]), "Fn::GetAtt") &&
    isSupportedArn(parts[0])
  );
}
