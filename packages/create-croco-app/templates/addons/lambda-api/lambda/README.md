# Lambda HTTP API profile

Generate with `--preset production-app --backend-deploy lambda`. The console SPA is separate.
This is a minimal API using the generated DI graph, Croco Lambda Host, HTTP transport and
application-owned nodeTelemetry plugin. The sample repository, event bus and rate limiter are
process-local: cold starts and scaling do not share state. Reserved concurrency is one to limit
the sample's concurrency; it provides no durability, global atomicity or exactly-once execution.
No Clerk, Polar, QStash, database, queue or scheduler provider is installed by this profile.
The existing `saas-lambda` provider profile remains documentation-only.

```sh
pnpm install
pnpm lambda:package
pnpm lambda:check
pnpm lambda:smoke
sam validate --lint --template-file lambda/template.json
sam deploy --template-file lambda/template.json --resolve-s3 --capabilities CAPABILITY_IAM --guided
```

Install pnpm on the build machine and use the generated Node.js version requirement.
`pnpm lambda:package` reuses the invoking pnpm CLI; Corepack is not required.
It builds the API and deploys its production dependency closure into
`dist/lambda-package/`. SAM packages that directory with `dist/lambda.handler`; do not deploy
only the compiled JavaScript without its dependencies. Use a Linux x86_64 build environment
when adding native dependencies. The local fixture loads this deployment directory and invokes
API Gateway v2 events; it does not contact AWS or prove gateway IAM enforcement.
If the build fails, the previous deployment directory is preserved. After a successful build,
packaging replaces that directory; if deploy fails, fix the reported error and rerun
`pnpm lambda:package` before using SAM.

The HTTP API requires AWS IAM/SigV4 authorization. The application is a sample API without
end-user authentication. The local auth/cookie fixture exercises an injected fixture middleware,
not a production identity provider. Validate the deployed unsigned denial and signed access
with an authorized caller separately. Do not expose this sample publicly by removing the authorizer.
The execution role can write only this function's pre-created CloudWatch log group. There are
no wildcard service permissions, permanent keys, managed administrator policies or runtime secret reads.

The template owns timeout (30 seconds), reserved concurrency (one), memory, log retention and
HTTP API payload version. HTTP API invokes synchronously, so DLQ/async retries are not applicable.
SQS and scheduler event-source profiles and their DLQ policies require separate integration.
No Lambda exec wrapper, telemetry Layer or X-Ray instrumentation is installed. OTLP telemetry
is initialized through application lifecycle and flushed before every invocation completes,
including failure. Enable it with TelemetryEnabled and an OTLP OtlpEndpoint. Optional
TelemetryHeadersSecretArn points to a Secrets Manager JSON secret with a `headers` field;
CloudFormation resolves this reference using the deployer's permissions. It is not a secret value
and grants the function no Secrets Manager permission. Secret rotation requires updating the stack.
Never commit secret values or print resolved environment variables.

`lambda:check` is read-only and checks owned deployment/build/lifecycle hashes.
After reviewing intentional changes, `lambda:lock` adopts them and clears old verification claims.
Missing files cannot be adopted. Passing drift checks does not validate the SAM schema or AWS.
Run independent SAM validation and review its transformed IAM/invoke permissions before deployment.
Live AWS evidence requires deployment, signed/unsigned access, cookies/Problems, telemetry delivery,
secret resolution and operational concurrency/timeout checks. Until then, `liveAws` stays
`not-verified` and certification stays `not-certified`.
