import type { SearchDocument } from "@croco/search-core";
import { type SQL, sql } from "drizzle-orm";

const DOCUMENT_ID_COLUMN = "id";
const TENANT_ID_COLUMN = "tenant_id";

export function buildPostgresDocumentUpsertQuery(
  table: string,
  document: SearchDocument,
  tenantId: string,
): SQL {
  const documentEntries = Object.entries(document).filter(
    ([column]) => column !== TENANT_ID_COLUMN,
  );
  const insertEntries = [...documentEntries, [TENANT_ID_COLUMN, tenantId] as const];
  const updateColumns = documentEntries
    .map(([column]) => column)
    .filter((column) => column !== DOCUMENT_ID_COLUMN);

  const columnChunks = sql.join(
    insertEntries.map(([column]) => sql.identifier(column)),
    sql`, `,
  );
  const valueChunks = sql.join(
    insertEntries.map(([, value]) => sql.param(value)),
    sql`, `,
  );
  const updateChunks = sql.join(
    updateColumns.map(
      (column) => sql`${sql.identifier(column)} = EXCLUDED.${sql.identifier(column)}`,
    ),
    sql`, `,
  );

  return sql`
    INSERT INTO ${sql.identifier(table)} (${columnChunks})
    VALUES (${valueChunks})
    ON CONFLICT (${sql.identifier(TENANT_ID_COLUMN)}, ${sql.identifier(DOCUMENT_ID_COLUMN)})
    DO UPDATE SET ${updateChunks}
  `;
}
