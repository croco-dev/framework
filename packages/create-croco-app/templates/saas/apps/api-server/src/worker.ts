import type { CloudflareFetchEnv, CloudflareHostFetchHandler } from "@croco/preset-cloudflare";
import { createWorkerApplication, workerProblemResponse } from "./workerBootstrap";

const applications = new WeakMap<
  CloudflareFetchEnv,
  Promise<Awaited<ReturnType<typeof createWorkerApplication>>>
>();

const fetch: CloudflareHostFetchHandler = async (request, env, context) => {
  let ready = applications.get(env);
  if (ready === undefined) {
    ready = createWorkerApplication(env);
    applications.set(env, ready);
  }
  try {
    const app = await ready;
    return await app.fetch(request, env, context);
  } catch {
    // Native binding values, credentials and provider causes never enter public Problems.
    return workerProblemResponse("CROCO_SAAS_PROFILE_BOOTSTRAP_FAILED");
  }
};

export default { fetch };
