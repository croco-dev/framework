import { application } from "../../../server/application";
import {
  LOCAL_IDENTITIES,
  LocalSessionProvider,
  localDemoEnabled,
  SESSION_COOKIE,
  isLocalSameOrigin,
} from "../../../server/LocalSessionProvider";

export const runtime = "nodejs";

export const POST = application.bindHostCallback(async (request: Request) => {
  if (!localDemoEnabled()) return new Response("Not Found", { status: 404 });
  if (!isLocalSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const identity = (await request.formData()).get("identity");
  if (typeof identity !== "string" || !Object.hasOwn(LOCAL_IDENTITIES, identity)) {
    return new Response("Unknown local identity", { status: 400 });
  }
  const token = application
    .get(LocalSessionProvider)
    .issue(identity as keyof typeof LOCAL_IDENTITIES);
  return new Response(null, {
    status: 303,
    headers: {
      location: "/try",
      "set-cookie": `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`,
      "cache-control": "no-store",
    },
  });
});
