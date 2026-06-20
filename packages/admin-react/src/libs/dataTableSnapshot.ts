import type { CursorPageFull } from "@croco/pagination-core";
import type { ProblemDetails } from "@croco/problems-core";

import {
  type AdminDataTableCursorPageInput,
  type AdminDataTableListResult,
  type AdminDataTableListSource,
  type AdminDataTableOffsetPageInput,
  type AdminDataTablePaginationSummary,
  type AdminDataTableResource,
  type AdminDataTableRow,
  type AdminDataTableSearchResultInput,
  type AdminDataTableState,
  type AdminDataTableStateBase,
  type AdminDataTableStateInput,
} from "./dataTableTypes";
import { createCoreProblemDetails } from "./snapshot";

export function createAdminDataTablePermissionDeniedProblemDetails(
  resourceId: string,
  missingPermissions: readonly string[],
): ProblemDetails {
  return createCoreProblemDetails({
    code: "admin-table/permission-denied",
    detail: `Resource '${resourceId}' requires permissions: ${missingPermissions.join(", ")}`,
    source: "permissions",
    status: 403,
    title: "Forbidden",
  });
}

export function createAdminDataTableInvalidRowIdProblemDetails(
  resourceId: string,
  detail: string,
): ProblemDetails {
  return createCoreProblemDetails({
    code: "admin-table/invalid-row-id",
    detail: `Resource '${resourceId}' produced invalid row ids: ${detail}`,
    source: "admin-react",
    status: 500,
    title: "Invalid Admin Table Row Id",
  });
}

export function createAdminDataTableState<TData>(
  input: AdminDataTableStateInput<TData>,
): AdminDataTableState<TData> {
  const generatedAt = input.generatedAt ?? new Date();
  const requiredPermissions = input.requiredPermissions ?? input.resource.requiredPermissions ?? [];
  const grantedPermissions = input.grantedPermissions ?? [];
  const missingPermissions = requiredPermissions.filter(
    (permission) => !grantedPermissions.includes(permission),
  );
  const base: AdminDataTableStateBase<TData> = {
    bulkActions: input.resource.bulkActions ?? [],
    filters: input.filters ?? [],
    generatedAt,
    grantedPermissions,
    recoveryActions: input.recoveryActions ?? [],
    requiredPermissions,
    resource: input.resource,
    rowActions: input.resource.rowActions ?? [],
    selectedRowIds: input.selectedRowIds ?? [],
    sorting: input.sorting ?? [],
  };

  if (missingPermissions.length > 0) {
    return {
      ...base,
      kind: "permission_denied",
      missingPermissions,
      problem: createAdminDataTablePermissionDeniedProblemDetails(
        input.resource.id,
        missingPermissions,
      ),
    };
  }

  const listResult = input.result ?? createAdminDataTableListResult(input.rows ?? []);
  const materialized = materializeRows(input.resource, listResult.rows);

  if (input.problem) {
    return {
      ...base,
      kind: "problem",
      partialRows: materialized.rows,
      problem: input.problem,
    };
  }

  if (listResult.problem) {
    return {
      ...base,
      kind: "problem",
      partialRows: materialized.rows,
      problem: listResult.problem,
    };
  }

  if (materialized.problem) {
    return {
      ...base,
      kind: "problem",
      partialRows: materialized.rows,
      problem: materialized.problem,
    };
  }

  if (input.loading) {
    return {
      ...base,
      kind: "loading",
    };
  }

  const pagination = input.pagination ?? listResult.pagination ?? { mode: "none" };

  if (materialized.rows.length === 0) {
    return {
      ...base,
      kind: "empty",
      pagination,
      rows: [],
      source: listResult.source,
      total: listResult.total ?? 0,
    };
  }

  return {
    ...base,
    kind: "ready",
    pagination,
    rows: materialized.rows,
    source: listResult.source,
    total: listResult.total ?? materialized.rows.length,
  };
}

export function createAdminDataTableListResult<TData>(
  rows: readonly TData[],
  options?: {
    readonly pagination?: AdminDataTablePaginationSummary;
    readonly problem?: ProblemDetails;
    readonly source?: AdminDataTableListSource;
    readonly total?: number;
  },
): AdminDataTableListResult<TData> {
  return {
    pagination: options?.pagination,
    problem: options?.problem,
    rows,
    source: options?.source ?? "manual",
    total: options?.total,
  };
}

export function createAdminDataTableListResultFromOffsetPage<TData>(
  page: AdminDataTableOffsetPageInput<TData>,
  options?: {
    readonly problem?: ProblemDetails;
    readonly source?: AdminDataTableListSource;
  },
): AdminDataTableListResult<TData> {
  return createAdminDataTableListResult(page.data, {
    pagination: {
      hasNext: page.offset + page.limit < page.total,
      hasPrevious: page.offset > 0,
      limit: page.limit,
      mode: "offset",
      offset: page.offset,
      total: page.total,
    },
    problem: options?.problem,
    source: options?.source ?? "offset-page",
    total: page.total,
  });
}

export function createAdminDataTableListResultFromCursorPage<TData>(
  page: AdminDataTableCursorPageInput<TData>,
  options?: {
    readonly limit?: number;
    readonly problem?: ProblemDetails;
    readonly source?: AdminDataTableListSource;
  },
): AdminDataTableListResult<TData> {
  const fullPage = isCursorPageFull(page) ? page : undefined;

  return createAdminDataTableListResult(page.data, {
    pagination: {
      hasMore: page.hasMore,
      hasPrevious: fullPage?.hasPrevious,
      limit: options?.limit,
      mode: "cursor",
      nextCursor: page.nextCursor,
      prevCursor: fullPage?.prevCursor,
    },
    problem: options?.problem,
    source: options?.source ?? "cursor-page",
  });
}

export function createAdminDataTableListResultFromSearchResult<TData>(
  result: AdminDataTableSearchResultInput<TData>,
  options?: {
    readonly problem?: ProblemDetails;
    readonly source?: AdminDataTableListSource;
  },
): AdminDataTableListResult<TData> {
  return {
    problem: options?.problem,
    rows: result.hits.map((hit) => hit.document),
    search: result.query,
    source: options?.source ?? "search-result",
    total: result.total,
  };
}

function materializeRows<TData>(
  resource: AdminDataTableResource<TData>,
  rows: readonly TData[],
): {
  readonly problem?: ProblemDetails;
  readonly rows: readonly AdminDataTableRow<TData>[];
} {
  const seen = new Set<string>();
  const materialized: AdminDataTableRow<TData>[] = [];

  for (const row of rows) {
    const id = resource.rowId(row);

    if (id.length === 0) {
      return {
        problem: createAdminDataTableInvalidRowIdProblemDetails(resource.id, "empty row id"),
        rows: materialized,
      };
    }

    if (seen.has(id)) {
      return {
        problem: createAdminDataTableInvalidRowIdProblemDetails(resource.id, `duplicate '${id}'`),
        rows: materialized,
      };
    }

    seen.add(id);
    materialized.push({ data: row, id });
  }

  return { rows: materialized };
}

function isCursorPageFull<TData>(
  page: AdminDataTableCursorPageInput<TData>,
): page is CursorPageFull<TData> {
  return "hasPrevious" in page || "prevCursor" in page;
}
