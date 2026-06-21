import type {
  CursorPage,
  CursorPageFull,
  OffsetPage,
  PaginationParams,
} from "@croco/pagination-core";
import type { ProblemDetails } from "@croco/problems-core";
import type { SearchQuery, SearchResult } from "@croco/search-core";
import type { ReactNode } from "react";

import type { AdminActionContract } from "./types";

export type AdminDataTableRowId = string;

export type AdminDataTableSortDirection = "asc" | "desc";

export type AdminDataTableFilterOperator =
  | "equals"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "in"
  | "gte"
  | "lte";

export type AdminDataTableFilterScalar = string | number | boolean | Date;

export type AdminDataTableFilterValue =
  | AdminDataTableFilterScalar
  | readonly AdminDataTableFilterScalar[]
  | null;

export type AdminDataTableField<TData> = Extract<keyof TData, string>;

export type AdminDataTableCellContext<TData, TValue = unknown> = {
  readonly column: AdminDataTableColumn<TData, TValue>;
  readonly row: TData;
  readonly rowId: AdminDataTableRowId;
  readonly value: TValue;
};

export type AdminDataTableColumn<TData, TValue = unknown> = {
  readonly id: string;
  readonly header: string;
  readonly field?: AdminDataTableField<TData>;
  readonly accessor?: (row: TData) => TValue;
  readonly render?: (context: AdminDataTableCellContext<TData, TValue>) => ReactNode;
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly width?: string;
};

export type AdminDataTableFilter<TData = unknown> = {
  readonly id: string;
  readonly field?: AdminDataTableField<TData> | string;
  readonly operator: AdminDataTableFilterOperator;
  readonly value: AdminDataTableFilterValue;
};

export type AdminDataTableFilterDefinition<TData> = {
  readonly id: string;
  readonly label: string;
  readonly field?: AdminDataTableField<TData>;
  readonly operator: AdminDataTableFilterOperator;
  readonly defaultValue?: AdminDataTableFilterValue;
};

export type AdminDataTableSort<TData = unknown> = {
  readonly id: string;
  readonly field?: AdminDataTableField<TData> | string;
  readonly direction: AdminDataTableSortDirection;
};

export type AdminDataTableListQuery<TData = unknown> = {
  readonly filters: readonly AdminDataTableFilter<TData>[];
  readonly pagination?: PaginationParams;
  readonly search?: SearchQuery;
  readonly sorting: readonly AdminDataTableSort<TData>[];
};

export type AdminDataTableListLoader<TData> = (
  query: AdminDataTableListQuery<TData>,
) => Promise<AdminDataTableListResult<TData>>;

export type AdminDataTableListConfig<TData> = {
  readonly generatedClient?: string;
  readonly queryKey?: readonly unknown[];
  readonly queryOptions?: Readonly<Record<string, unknown>>;
  readonly load?: AdminDataTableListLoader<TData>;
};

export type AdminDataTableResource<TData> = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly rowId: (row: TData) => AdminDataTableRowId;
  readonly columns: readonly AdminDataTableColumn<TData>[];
  readonly filters?: readonly AdminDataTableFilterDefinition<TData>[];
  readonly list?: AdminDataTableListConfig<TData>;
  readonly requiredPermissions?: readonly string[];
  readonly rowActions?: readonly AdminActionContract[];
  readonly bulkActions?: readonly AdminActionContract[];
};

export type AdminDataTablePaginationSummary =
  | {
      readonly mode: "none";
    }
  | {
      readonly hasNext: boolean;
      readonly hasPrevious: boolean;
      readonly limit: number;
      readonly mode: "offset";
      readonly offset: number;
      readonly total: number;
    }
  | {
      readonly hasMore: boolean;
      readonly hasPrevious?: boolean;
      readonly limit?: number;
      readonly mode: "cursor";
      readonly nextCursor: string | null;
      readonly prevCursor?: string | null;
    };

export type AdminDataTableListSource =
  | "manual"
  | "generated-client"
  | "offset-page"
  | "cursor-page"
  | "search-result";

export type AdminDataTableListResult<TData> = {
  readonly pagination?: AdminDataTablePaginationSummary;
  readonly problem?: ProblemDetails;
  readonly rows: readonly TData[];
  readonly search?: SearchQuery;
  readonly source: AdminDataTableListSource;
  readonly total?: number;
};

export type AdminDataTableRow<TData> = {
  readonly data: TData;
  readonly id: AdminDataTableRowId;
};

export type AdminDataTableStateBase<TData> = {
  readonly bulkActions: readonly AdminActionContract[];
  readonly filters: readonly AdminDataTableFilter<TData>[];
  readonly generatedAt: Date;
  readonly grantedPermissions: readonly string[];
  readonly recoveryActions: readonly AdminActionContract[];
  readonly requiredPermissions: readonly string[];
  readonly resource: AdminDataTableResource<TData>;
  readonly rowActions: readonly AdminActionContract[];
  readonly selectedRowIds: readonly AdminDataTableRowId[];
  readonly sorting: readonly AdminDataTableSort<TData>[];
};

export type AdminDataTableLoadingState<TData> = AdminDataTableStateBase<TData> & {
  readonly kind: "loading";
};

export type AdminDataTableReadyState<TData> = AdminDataTableStateBase<TData> & {
  readonly kind: "ready";
  readonly pagination: AdminDataTablePaginationSummary;
  readonly rows: readonly AdminDataTableRow<TData>[];
  readonly source: AdminDataTableListSource;
  readonly total: number;
};

export type AdminDataTableEmptyState<TData> = AdminDataTableStateBase<TData> & {
  readonly kind: "empty";
  readonly pagination: AdminDataTablePaginationSummary;
  readonly rows: readonly [];
  readonly source: AdminDataTableListSource;
  readonly total: number;
};

export type AdminDataTableProblemState<TData> = AdminDataTableStateBase<TData> & {
  readonly kind: "problem";
  readonly partialRows: readonly AdminDataTableRow<TData>[];
  readonly problem: ProblemDetails;
};

export type AdminDataTablePermissionDeniedState<TData> = AdminDataTableStateBase<TData> & {
  readonly kind: "permission_denied";
  readonly missingPermissions: readonly string[];
  readonly problem: ProblemDetails;
};

export type AdminDataTableState<TData> =
  | AdminDataTableLoadingState<TData>
  | AdminDataTableReadyState<TData>
  | AdminDataTableEmptyState<TData>
  | AdminDataTableProblemState<TData>
  | AdminDataTablePermissionDeniedState<TData>;

export type AdminDataTableStateInput<TData> = {
  readonly filters?: readonly AdminDataTableFilter<TData>[];
  readonly generatedAt?: Date;
  readonly grantedPermissions?: readonly string[];
  readonly loading?: boolean;
  readonly pagination?: AdminDataTablePaginationSummary;
  readonly problem?: ProblemDetails;
  readonly recoveryActions?: readonly AdminActionContract[];
  readonly requiredPermissions?: readonly string[];
  readonly resource: AdminDataTableResource<TData>;
  readonly result?: AdminDataTableListResult<TData>;
  readonly rows?: readonly TData[];
  readonly selectedRowIds?: readonly AdminDataTableRowId[];
  readonly sorting?: readonly AdminDataTableSort<TData>[];
};

export type AdminDataTableRowActionEvent<TData> = {
  readonly action: AdminActionContract;
  readonly row: AdminDataTableRow<TData>;
  readonly state: AdminDataTableReadyState<TData> | AdminDataTableEmptyState<TData>;
};

export type AdminDataTableBulkActionEvent<TData> = {
  readonly action: AdminActionContract;
  readonly rows: readonly AdminDataTableRow<TData>[];
  readonly selectedRowIds: readonly AdminDataTableRowId[];
  readonly state: AdminDataTableReadyState<TData> | AdminDataTableEmptyState<TData>;
};

export type AdminDataTableSortChangeEvent<TData> = {
  readonly column: AdminDataTableColumn<TData>;
  readonly sorting: readonly AdminDataTableSort<TData>[];
  readonly state: AdminDataTableReadyState<TData> | AdminDataTableEmptyState<TData>;
};

export type AdminDataTableFilterChangeEvent<TData> = {
  readonly filters: readonly AdminDataTableFilter<TData>[];
  readonly state: AdminDataTableReadyState<TData> | AdminDataTableEmptyState<TData>;
};

export type AdminDataTablePageChangeEvent<TData> = {
  readonly pagination: PaginationParams;
  readonly state: AdminDataTableReadyState<TData> | AdminDataTableEmptyState<TData>;
};

export type AdminDataTableSelectionChangeEvent<TData> = {
  readonly rows: readonly AdminDataTableRow<TData>[];
  readonly selectedRowIds: readonly AdminDataTableRowId[];
  readonly state: AdminDataTableReadyState<TData> | AdminDataTableEmptyState<TData>;
};

export type AdminDataTableRecoveryActionEvent<TData> = {
  readonly action: AdminActionContract;
  readonly state: AdminDataTableProblemState<TData>;
};

export type AdminDataTableProps<TData> = {
  readonly onBulkAction?: (event: AdminDataTableBulkActionEvent<TData>) => void;
  readonly onFilterChange?: (event: AdminDataTableFilterChangeEvent<TData>) => void;
  readonly onPageChange?: (event: AdminDataTablePageChangeEvent<TData>) => void;
  readonly onRecoveryAction?: (event: AdminDataTableRecoveryActionEvent<TData>) => void;
  readonly onRowAction?: (event: AdminDataTableRowActionEvent<TData>) => void;
  readonly onSelectionChange?: (event: AdminDataTableSelectionChangeEvent<TData>) => void;
  readonly onSortChange?: (event: AdminDataTableSortChangeEvent<TData>) => void;
  readonly state: AdminDataTableState<TData>;
};

export type AdminDataTableOffsetPageInput<TData> = OffsetPage<TData>;

export type AdminDataTableCursorPageInput<TData> = CursorPage<TData> | CursorPageFull<TData>;

export type AdminDataTableSearchResultInput<TData> = SearchResult<TData>;
