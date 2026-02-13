import type { MembershipRole } from '@croco/membership-core';
import { pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';

export const memberships = pgTable(
  'memberships',
  {
    id: text('id').notNull().primaryKey(),
    tenantId: text('tenant_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role', { enum: ['owner', 'admin', 'member', 'viewer'] })
      .$type<MembershipRole>()
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [unique('memberships_tenant_id_user_id_unique').on(table.tenantId, table.userId)]
);
