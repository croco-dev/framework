import { pool } from "./database";
import type { ResourceResolver, ExperienceScope, ExperienceSubject } from "@croco/experience-core";
export type Report = {
  id: string;
  title: string;
  body: string;
  revoked: boolean;
  deleted: boolean;
  expires_at: Date;
  owner_id: string;
};
/** App-owned source repository: Croco stores references, never report titles or content. */
export async function readReport(scope: ExperienceScope, id: string): Promise<Report | undefined> {
  const result = await pool.query<Report>(
    "SELECT id,title,body,revoked,deleted,expires_at,owner_id FROM saved_demo_reports WHERE app_id=$1 AND environment=$2 AND tenant_id=$3 AND id=$4",
    [scope.appId, scope.environment, scope.tenantId, id],
  );
  return result.rows[0];
}
export function canRead(report: Report, subject: ExperienceSubject): boolean {
  return subject.kind === "customer" && report.owner_id === subject.id && !report.revoked;
}
export function reportResolver(): ResourceResolver {
  return async ({ scope, subject, resourceId }) => {
    const report = await readReport(scope, resourceId);
    if (!report || report.deleted) return { availability: "deleted" };
    if (!canRead(report, subject)) return { availability: "denied" };
    if (report.expires_at.getTime() <= Date.now()) return { availability: "expired" };
    return {
      availability: "available",
      label: report.title,
      safeUrl: `/reports/${encodeURIComponent(report.id)}`,
    };
  };
}
