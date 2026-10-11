import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { application } from "./application";
import { LocalSessionProvider, SESSION_COOKIE } from "./LocalSessionProvider";

export async function requirePageIdentity() {
  const cookie = (await cookies()).get(SESSION_COOKIE);
  const user = await application.run(() =>
    application.get(LocalSessionProvider).authenticate(
      new Request("http://localhost/", {
        headers: { cookie: cookie ? `${SESSION_COOKIE}=${cookie.value}` : "" },
      }),
    ),
  );
  if (!user?.tenantId) redirect("/sign-in");
  return { userId: user.id, tenantId: user.tenantId };
}
