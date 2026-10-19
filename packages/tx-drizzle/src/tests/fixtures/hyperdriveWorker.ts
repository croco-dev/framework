import { sql } from "drizzle-orm";
import {
  HyperdriveTransactionProblem,
  withHyperdriveTransaction,
} from "../../../dist/hyperdrive.mjs";
import type { HyperdriveBinding } from "../../../dist/hyperdrive.mjs";

type Bindings = { HYPERDRIVE?: HyperdriveBinding };

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname.slice(1);
    // Synthetic identities selected by the harness, never an application authorization recipe.
    const tenant = url.searchParams.get("tenant") === "b" ? "tenant-b" : "tenant-a";
    const controller = new AbortController();
    if (action === "pre-abort") controller.abort("private-abort-secret");
    try {
      const result = await withHyperdriveTransaction(
        env.HYPERDRIVE,
        async (tx) => {
          await tx.execute(sql`select set_config('croco.tenant', ${tenant}, true)`);
          if (action === "timeout") await tx.execute(sql`select pg_sleep(1)`);
          if (action === "abort") {
            await tx.execute(
              sql`insert into hyperdrive_claims (id, tenant, value) values ('aborted', ${tenant}, 43)`,
            );
            controller.abort("private-abort-secret");
            await tx.execute(sql`select 1`);
          }
          if (action === "claim") {
            const claimed = await tx.execute(sql`insert into hyperdrive_claims (id, tenant, value)
            values ('shared', ${tenant}, 73) on conflict do nothing returning id`);
            return { claimed: claimed.rowCount };
          }
          if (action === "cas") {
            const changed = await tx.execute(sql`update hyperdrive_claims set value = 91
            where id = 'shared' and value = 73 returning id`);
            return { changed: changed.rowCount };
          }
          if (action === "rollback") {
            await tx.execute(
              sql`insert into hyperdrive_claims (id, tenant, value) values ('rolled-back', ${tenant}, 29)`,
            );
            // The independent persisted-state oracle checks that this failed statement rolls back the insert.
            await tx.execute(sql`select private_parameter_secret from nonexistent_private_table`);
          }
          if (action === "savepoint") {
            await tx.execute(
              sql`insert into hyperdrive_claims (id, tenant, value) values ('outer', ${tenant}, 31)`,
            );
            try {
              await tx.transaction(async (nested) => {
                await nested.execute(
                  sql`insert into hyperdrive_claims (id, tenant, value) values ('inner', ${tenant}, 47)`,
                );
                await nested.execute(sql`select 1/0`);
              });
            } catch {
              /* Expected savepoint rollback; outer transaction must remain usable. */
            }
          }
          const rows = await tx.execute(
            sql`select id, tenant, value from hyperdrive_claims order by id`,
          );
          return { rows: rows.rows };
        },
        {
          signal: controller.signal,
          connectionTimeoutMs: action === "connect-timeout" ? 25 : 5000,
          statementTimeoutMs: action === "timeout" ? 25 : 2000,
        },
      );
      return Response.json(result);
    } catch (error) {
      if (error instanceof HyperdriveTransactionProblem)
        return Response.json(error, { status: 503 });
      return Response.json({ unexpected: true }, { status: 500 });
    }
  },
};
