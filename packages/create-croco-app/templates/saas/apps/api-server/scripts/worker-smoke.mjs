import { unstable_dev } from "wrangler";
const options = {
  config: "wrangler.toml",
  local: true,
  logLevel: "error",
  vars: { SAAS_PROVIDER_PROFILE: "saas-cloudflare", PRIVATE_SENTINEL: "private-worker-binding" },
  experimental: { disableExperimentalWarning: true, disableDevRegistry: true, watch: false },
};
const worker = await unstable_dev("src/worker.ts", options);
try {
  const response = await worker.fetch("http://example.com/ops/health");
  const body = await response.json();
  if (
    response.status !== 200 ||
    body.scope !== "bootstrap-only" ||
    body.fullSaas !== false ||
    body.capabilities.filter((entry) => entry.state === "unavailable").length !== 8
  )
    throw new Error(`Invalid bootstrap readiness: ${JSON.stringify(body)}`);
  const denied = await worker.fetch("http://example.com/webhooks/polar", {
    method: "POST",
    headers: { "polar-signature": "private-worker-binding" },
    body: "private-worker-binding",
  });
  const failure = await denied.text();
  if (
    denied.status !== 501 ||
    !failure.includes("CROCO_SAAS_PROFILE_CAPABILITY_UNAVAILABLE") ||
    failure.includes("private-worker-binding")
  )
    throw new Error(`Unsafe unsupported webhook result: ${failure}`);
} finally {
  await worker.stop();
}
const invalid = await unstable_dev("src/worker.ts", {
  ...options,
  vars: { SAAS_PROVIDER_PROFILE: "private-invalid-profile" },
});
try {
  const response = await invalid.fetch("http://example.com/ops/health");
  const body = await response.text();
  if (
    response.status !== 500 ||
    !body.includes("CROCO_SAAS_PROFILE_BOOTSTRAP_FAILED") ||
    body.includes("private-invalid-profile")
  )
    throw new Error(`Unsafe bootstrap failure: ${body}`);
} finally {
  await invalid.stop();
}
