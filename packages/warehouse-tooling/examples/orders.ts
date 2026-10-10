import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
});
