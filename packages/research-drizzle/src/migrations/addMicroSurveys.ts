import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

/** Explicit migration. Never run from application boot; use the application's migration owner. */
export async function addMicroSurveys(db: {
  execute(statement: SQL): Promise<unknown>;
}): Promise<void> {
  await db.execute(sql`create table if not exists research_records (
    tenant_id text not null check(length(tenant_id)>0), app_id text not null check(length(app_id)>0), environment_id text not null check(length(environment_id)>0),
    kind text not null check(kind in ('definition','invitation','response','audit')), id text not null, family_id text not null,
    payload jsonb not null check(jsonb_typeof(payload)='object'), primary key(tenant_id,app_id,environment_id,kind,id)
  )`);
  await db.execute(
    sql`create index if not exists research_family_idx on research_records(tenant_id,app_id,environment_id,kind,family_id,id)`,
  );
  await db.execute(
    sql`create unique index if not exists research_definition_revision_idx on research_records(tenant_id,app_id,environment_id,family_id,((payload->>'revision')::bigint)) where kind='definition'`,
  );
  await db.execute(
    sql`create index if not exists research_frequency_idx on research_records(tenant_id,app_id,environment_id,family_id,(payload->'subject'->>'kind'),(payload->'subject'->>'id'),(payload->>'createdAt')) where kind='invitation'`,
  );
  await db.execute(
    sql`create index if not exists research_response_invitation_idx on research_records(tenant_id,app_id,environment_id,(payload->>'invitationId')) where kind='response'`,
  );
}
