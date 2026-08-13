import { sql } from "drizzle-orm";

export type MembershipSeatOrdinalMigrationClient = {
  execute(query: ReturnType<typeof sql>): Promise<unknown>;
};

export async function addMembershipSeatOrdinals(
  db: MembershipSeatOrdinalMigrationClient,
): Promise<void> {
  await db.execute(sql`
    create sequence if not exists membership_seat_ordinal_seq;

    alter table memberships
      add column if not exists seat_ordinal bigint;

    with unassigned as (
      select id, -nextval('membership_seat_ordinal_seq') as seat_ordinal
      from memberships
      where seat_ordinal is null
      order by tenant_id, created_at, id
    )
    update memberships
    set seat_ordinal = unassigned.seat_ordinal
    from unassigned
    where memberships.id = unassigned.id;

    alter table memberships
      alter column seat_ordinal set default -nextval('membership_seat_ordinal_seq'),
      alter column seat_ordinal set not null;

    create unique index if not exists memberships_tenant_id_seat_ordinal_unique
      on memberships (tenant_id, seat_ordinal);
  `);
}
