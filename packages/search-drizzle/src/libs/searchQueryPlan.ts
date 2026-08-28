import type { SearchQuery } from "@croco/search-core";
import { type SQL, sql } from "drizzle-orm";
import { InvalidSearchQueryProblem } from "./problems/InvalidSearchQueryProblem";
import type { SearchQueryPlan } from "./types";

const POSTGRES_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const TENANT_FILTER_FIELDS = new Set(["tenantId", "tenant_id"]);

type SearchQueryPlanInput = {
  table: string;
  query: SearchQuery;
  tenantId: string;
  searchPredicate: SQL;
  scoreExpression: SQL;
};

function identifier(value: string, option: string): SQL {
  if (!POSTGRES_IDENTIFIER_PATTERN.test(value)) {
    throw new InvalidSearchQueryProblem(
      option,
      "must start with a letter or underscore and contain at most 63 ASCII letters, digits, or underscores",
    );
  }

  return sql`${sql.identifier(value)}`;
}

function compileFilters(query: SearchQuery, tenantId: string): SQL[] {
  if (query.filters === undefined) {
    return [];
  }

  if (query.filters === null || typeof query.filters !== "object" || Array.isArray(query.filters)) {
    throw new InvalidSearchQueryProblem("filters", "must be an object");
  }

  return Object.entries(query.filters).flatMap(([field, value]) => {
    const option = `filters.${field}`;

    if (TENANT_FILTER_FIELDS.has(field)) {
      if (value !== tenantId) {
        throw new InvalidSearchQueryProblem(option, "must match the active tenant context");
      }
      return [];
    }

    const supportedValue =
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value));
    if (!supportedValue) {
      throw new InvalidSearchQueryProblem(
        option,
        "must be a string, finite number, or boolean equality value",
      );
    }

    const fieldIdentifier = identifier(field, option);
    return [sql`${fieldIdentifier} = ${sql.param(value)}`];
  });
}

function compileSort(query: SearchQuery): { expressions: SQL[]; includesId: boolean } {
  if (query.sort === undefined) {
    return { expressions: [], includesId: false };
  }

  if (!Array.isArray(query.sort)) {
    throw new InvalidSearchQueryProblem("sort", "must be an array");
  }

  let includesId = false;
  const expressions = query.sort.map((item, index) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new InvalidSearchQueryProblem(`sort.${index}`, "must be an object");
    }

    const field = Reflect.get(item, "field");
    const order = Reflect.get(item, "order");
    if (typeof field !== "string") {
      throw new InvalidSearchQueryProblem(`sort.${index}.field`, "must be a string");
    }

    const fieldIdentifier = identifier(field, `sort.${index}.field`);
    if (order !== "asc" && order !== "desc") {
      throw new InvalidSearchQueryProblem(`sort.${index}.order`, "must be 'asc' or 'desc'");
    }

    includesId ||= field === "id";
    return sql`${fieldIdentifier} ${order === "asc" ? sql`ASC` : sql`DESC`}`;
  });

  return { expressions, includesId };
}

function compilePaginationValue(
  value: number | undefined,
  option: "limit" | "offset",
): SQL | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new InvalidSearchQueryProblem(option, "must be a non-negative safe integer");
  }

  return option === "limit" ? sql`LIMIT ${sql.param(value)}` : sql`OFFSET ${sql.param(value)}`;
}

/**
 * PostgreSQL 전략에 공통인 필터, 정렬, 페이지네이션 SQL을 컴파일합니다.
 */
export function buildPostgresSearchQueryPlan(input: SearchQueryPlanInput): SearchQueryPlan {
  const tableIdentifier = identifier(input.table, "table");
  const tenantIdentifier = identifier("tenant_id", "tenantId");
  const filterPredicates = compileFilters(input.query, input.tenantId);
  const predicate = sql.join(
    [
      input.searchPredicate,
      sql`${tenantIdentifier} = ${sql.param(input.tenantId)}`,
      ...filterPredicates,
    ],
    sql` AND `,
  );
  const sort = compileSort(input.query);
  const orderExpressions = [
    ...sort.expressions,
    sql`${input.scoreExpression} DESC`,
    ...(sort.includesId ? [] : [sql`${identifier("id", "sort.id")} ASC`]),
  ];
  const pagination = [
    compilePaginationValue(input.query.limit, "limit"),
    compilePaginationValue(input.query.offset, "offset"),
  ].filter((value): value is SQL => value !== undefined);

  return {
    rows: sql`
      SELECT *, ${input.scoreExpression} AS ${sql.identifier("__croco_search_score")}
      FROM ${tableIdentifier}
      WHERE ${predicate}
      ORDER BY ${sql.join(orderExpressions, sql`, `)}
      ${sql.join(pagination, sql` `)}
    `,
    total: sql`
      SELECT COUNT(*)::double precision AS total
      FROM ${tableIdentifier}
      WHERE ${predicate}
    `,
  };
}
