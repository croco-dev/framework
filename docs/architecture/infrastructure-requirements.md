# Static infrastructure requirements

`defineInfrastructureRequirements` from `@croco/framework-context` declares the application's
resource IDs, kinds, required capabilities, owner, scope and optional secret reference. It does
not provision resources or register providers. Plugins and application composition own the
requirements; changing a binding does not make an unselected plugin executable.

```ts typecheck
import { defineInfrastructureRequirements } from "@croco/framework-context";

export const requirements = defineInfrastructureRequirements({
  runtime: "lambda",
  runtimeCapabilities: ["env", "deadline"],
  resources: [
    {
      id: "jobs",
      kind: "queue",
      capabilities: ["enqueue"],
      owner: "orders",
      scope: "Api",
    },
  ],
});
```

Serialize this declaration to `croco-infrastructure-requirements.json`. The function projects
only the declared reference fields; do not put credentials in IDs, owner, scope or secretRef.
`optional: true` permits an absent binding. Once supplied, an optional binding receives every
normal check. Unrequired native resources are ignored; unrequired binding claims fail.
Duplicate IDs and binding claims fail. Kubernetes environment names must be unique; an entry
cannot supply both a literal value and valueFrom. Each valueFrom must select exactly one
supported source (fieldRef, resourceFieldRef, configMapKeyRef or secretKeyRef). Owner and scope must match exactly.

## Build/CI entrypoint

`create-croco-app/dist/verification.js` exports `validateInfrastructure` for parsed artifacts and
`validateInfrastructureFiles` for project-relative files. The latter accepts a plan:

```json
{
  "profile": "aws-lambda",
  "workload": "Api",
  "requirements": "croco-infrastructure-requirements.json",
  "runtimeManifest": "croco-runtime-capability.manifest.json",
  "artifact": "cdk.out/Stack.template.json",
  "bindings": [
    {
      "requirement": "jobs",
      "resource": "JobsQueue",
      "owner": "orders",
      "scope": "Api"
    }
  ]
}
```

In an app-owned Node script, call `validateInfrastructureFiles(projectRoot, plan)`, print the
returned report and set `process.exitCode = 1` when `ok` is false. Run that script before build
and in CI. The requirements, runtime manifest and native artifact are read afresh each time;
no hash adoption can turn an invalid binding into a valid one. Paths, including symlinks,
must remain within the project. JSON, ordinary YAML and Wrangler TOML are supported.
CloudFormation YAML short intrinsic tags and Wrangler JSONC are unsupported: use synthesized
JSON or long-form intrinsic YAML. Pass one effective Wrangler config without an `env` table;
select and flatten the target environment with your deployment tooling, because bindings are
not inherited. Unsupported or ambiguous input fails closed.

Diagnostics expose stable codes and zero-based requirement indices, never input strings or
native artifacts. Parser/filesystem failures emit `CROCO_INFRA_SCHEMA`, without exceptions
that might include secret source lines. Reports always say `static-artifact-only` and
`not-certified`. Keep secret values out of source-controlled artifacts; a secret key locator
or resource ID is sufficient for Croco's report.

| Code                     | Meaning                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `CROCO_INFRA_SCHEMA`     | Malformed/unsupported declaration, artifact encoding or file input                     |
| `CROCO_INFRA_RUNTIME`    | Wrong/missing workload, runtime, or required runtime capability                        |
| `CROCO_INFRA_BINDING`    | Missing/duplicate resource or binding, wrong owner/scope, unresolved endpoint          |
| `CROCO_INFRA_KIND`       | Wrong native kind or malformed native binding/port                                     |
| `CROCO_INFRA_PERMISSION` | Required operation is unsupported or lacks the supported static permission declaration |
| `CROCO_INFRA_SECRET`     | Secret reference, key or workload injection does not match                             |

## Profile contract and limits

| Profile              | Native artifact and minimum supported evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kubernetes`         | A resource array, Kubernetes List, or multi-document YAML. One uniquely named Deployment with one container. `scope` is its namespace (`default` when absent). Database/queue/storage endpoints use a namespaced Service, valid port and `binding.env` wired to `<service>.<namespace>.svc.cluster.local`; only `connect` is supported. Secret `read` requires a matching Secret/key and non-optional `env.valueFrom.secretKeyRef`. `secretRef` is the exact key.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `aws-lambda`         | Synthesized SAM/CloudFormation (including CDK). `scope` is the selected function logical ID. Node.js 22/24 Lambda with a Handler. SQS enqueue/dequeue means SendMessage/ReceiveMessage; DynamoDB read/write means GetItem/PutItem; S3 read/write means GetObject/PutObject; Secrets Manager read means GetSecretValue. Allow must name the exact action and local resource `Fn::GetAtt: [id, Arn]`; Secrets Manager uses `Ref: id` or `Fn::GetAtt: [id, Id]` instead. S3 object access uses `Fn::Join: ['', [bucketArn, '/*']]`. SAM inline Policies or the selected local Role's inline Policies are supported. Inline policy documents use Version/Id/Statement, and statements use Sid/Effect/Action/Resource only. Conflicting NotAction/NotResource selectors, conditional allows, deny statements, conditional resources and broader/wildcard policy inference fail closed. `secretRef` is the secret logical ID. |
| `cloudflare-workers` | Effective Wrangler config and matching worker name/scope, main and compatibility date. D1 read/write, R2 read/write, Queue producer enqueue, and Secrets Store read map to native bindings with resource locators. `secretRef` is Secrets Store `secret_name`, paired with `store_id`; ordinary Worker secrets cannot be proven present from config and are unsupported. Claimed names must be unique across other native binding sections, including KV, services and Durable Objects. Consumer dequeue and Container resource semantics are not inferred.                                                                                                                                                                                                                                                                                                                                                             |

A Kubernetes Service does not prove a database dialect or queue API: this profile checks only
its native endpoint kind and connection declaration. It never grants data-plane operations
from annotations. AWS checks declared local IAM access, not effective permissions: external
policies, SCPs, boundaries, KMS, VPC access and remote state require separate verification.
Wrangler locators do not prove remote resource existence or provider account permission.
Artifact validation also does not prove that code, image, handler or remote endpoint executes.
Use the provider's native schema/deployment validators and live conformance checks for those
claims. Kernel/Contracts import no provider SDKs, and Kubernetes remains a Node infrastructure
profile, not a new runtime platform.

## Generated Kubernetes integration

The existing `production-app --backend-deploy kubernetes` profile generates the requirements,
binding plan and `pnpm infrastructure:check`. Root build runs this gate first. Its sample uses
process-local providers, so the resource requirements start empty; the optional external Secret
in the Deployment is not a verified provider claim. Selecting a real provider requires its
explicit resource declaration and concrete native resources. The infrastructure ownership
manifest tracks the two declarations and checker along with existing files. `k8s:lock` only
adopts reviewed hashes and clears prior verification; it never validates bindings.

The three profile fixtures and their negative cases run in `create-croco-app`'s test suite.
Generator tests exercise the emitted check with native artifacts and altered requirements.
Repository public API, test inventory, docs and Croco Skill gates cover generated drift.
SAM/CDK and Wrangler validation are callable tooling; this work does not create a new Lambda
or Cloudflare SaaS deployment profile, certify a live environment, or publish a package.

Native contracts: [IAM policy elements](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements.html),
[SAM function Policies](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-resource-function.html),
[Wrangler bindings](https://developers.cloudflare.com/workers/wrangler/configuration/),
[Secrets Store bindings](https://developers.cloudflare.com/secrets-store/integrations/workers/),
[Kubernetes Secret injection](https://kubernetes.io/docs/concepts/configuration/secret/#using-secrets-as-environment-variables).
