import type { CloudflareFetchEnv, CloudflareHostFetchHandler } from "@croco/preset-cloudflare";
import type { CloudflareScheduledHandler } from "@croco/preset-cloudflare/scheduled";
import { createWorkerApplication, workerProblemResponse } from "./workerBootstrap";

const applications = new WeakMap<
  CloudflareFetchEnv,
  Promise<Awaited<ReturnType<typeof createWorkerApplication>>>
>();

function getApplication(env: CloudflareFetchEnv) {
  let ready = applications.get(env);
  if (ready === undefined) {
    ready = createWorkerApplication(env);
    applications.set(env, ready);
  }
  return ready;
}

const fetch: CloudflareHostFetchHandler = async (request, env, context) => {
  try {
    const app = await getApplication(env);
    return await app.fetch(request, env, context);
  } catch {
    // Native binding values, credentials and provider causes never enter public Problems.
    return workerProblemResponse("CROCO_SAAS_PROFILE_BOOTSTRAP_FAILED");
  }
};

const scheduled: CloudflareScheduledHandler = async (event, env, context) => {
  const app = await getApplication(env);
  await app.scheduled(event, env, context);
};

export default { fetch, scheduled };
