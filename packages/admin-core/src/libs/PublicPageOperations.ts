import type { PublicPageInspection } from "@croco/seo-core";

/** Bind inspection targets and authorization on the server. No URLs or source facts enter through admin input. */
export function createPublicPageOperations(
  options: Readonly<{
    authorize: (targetId: string) => Promise<boolean>;
    inspect: (targetId: string) => Promise<PublicPageInspection>;
  }>,
) {
  return {
    async inspect(targetId: string): Promise<PublicPageInspection> {
      try {
        if (!(await options.authorize(targetId)))
          return {
            targetId,
            state: "denied",
            diagnostics: [{ code: "SEO_ADMIN_DENIED", field: "targetId" }],
          };
      } catch {
        return {
          targetId,
          state: "unavailable",
          diagnostics: [{ code: "SEO_AUTHORIZATION_UNAVAILABLE", field: "authorization" }],
        };
      }
      return options.inspect(targetId);
    },
  };
}
