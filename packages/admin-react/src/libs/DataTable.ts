import { createElement, Fragment, type ReactElement, type ReactNode } from "react";

import { ProblemNotice } from "./components";
import type {
  AdminDataTableBulkActionEvent,
  AdminDataTableColumn,
  AdminDataTableEmptyState,
  AdminDataTablePageChangeEvent,
  AdminDataTableProps,
  AdminDataTableProblemState,
  AdminDataTableReadyState,
  AdminDataTableRecoveryActionEvent,
  AdminDataTableRow,
  AdminDataTableRowActionEvent,
  AdminDataTableSelectionChangeEvent,
  AdminDataTableSort,
  AdminDataTableSortDirection,
  AdminDataTableState,
} from "./dataTableTypes";
import type { AdminActionContract } from "./types";

type RenderableTableState<TData> =
  | AdminDataTableReadyState<TData>
  | AdminDataTableEmptyState<TData>;

export function AdminDataTable<TData>({
  onBulkAction,
  onFilterChange,
  onPageChange,
  onRecoveryAction,
  onRowAction,
  onSelectionChange,
  onSortChange,
  state,
}: AdminDataTableProps<TData>): ReactElement {
  if (state.kind === "loading") {
    return createElement(
      "section",
      {
        "aria-label": `${state.resource.label} table`,
        "data-testid": "admin-data-table-loading",
        role: "status",
      },
      createElement("h2", null, state.resource.label),
      createElement("p", null, "Loading"),
    );
  }

  if (state.kind === "permission_denied") {
    return createElement(
      "section",
      {
        "aria-label": `${state.resource.label} table`,
        "data-testid": "admin-data-table-permission-denied",
        role: "alert",
      },
      createElement("h2", null, state.resource.label),
      createElement(ProblemNotice, { problem: state.problem }),
      createElement(
        "p",
        { "data-testid": "admin-data-table-missing-permissions" },
        `Missing permissions: ${state.missingPermissions.join(", ")}`,
      ),
    );
  }

  if (state.kind === "problem") {
    return createElement(
      "section",
      {
        "aria-label": `${state.resource.label} table`,
        "data-testid": "admin-data-table-problem",
        role: "alert",
      },
      createElement("h2", null, state.resource.label),
      createElement(ProblemNotice, { problem: state.problem }),
      renderRecoveryActions(state, onRecoveryAction),
    );
  }

  return renderTable(state, {
    onBulkAction,
    onFilterChange,
    onPageChange,
    onRowAction,
    onSelectionChange,
    onSortChange,
  });
}

function renderTable<TData>(
  state: RenderableTableState<TData>,
  handlers: Omit<AdminDataTableProps<TData>, "state">,
): ReactElement {
  return createElement(
    "section",
    {
      "aria-label": `${state.resource.label} table`,
      "data-source": state.source,
      "data-state": state.kind,
      "data-testid": "admin-data-table",
    },
    createElement("h2", null, state.resource.label),
    renderFilterChips(state, handlers.onFilterChange),
    renderBulkActions(state, handlers.onBulkAction),
    createElement(
      "table",
      { "data-testid": "admin-data-table-grid" },
      renderHeader(state, handlers.onSortChange),
      renderBody(state, handlers.onRowAction, handlers.onSelectionChange),
    ),
    state.kind === "empty"
      ? createElement("p", { "data-state": "empty" }, `No ${state.resource.label} found`)
      : null,
    renderPagination(state, handlers.onPageChange),
  );
}

function renderHeader<TData>(
  state: RenderableTableState<TData>,
  onSortChange: AdminDataTableProps<TData>["onSortChange"],
): ReactElement {
  return createElement(
    "thead",
    null,
    createElement(
      "tr",
      null,
      createElement("th", { scope: "col" }, "Select"),
      state.resource.columns.map((column) => {
        const activeSort = state.sorting.find((sort) => sort.id === column.id);
        const sortDirection = activeSort?.direction;

        return createElement(
          "th",
          {
            "data-column-id": column.id,
            "data-filterable": column.filterable === true ? "true" : "false",
            "data-sort-direction": sortDirection,
            "data-sortable": column.sortable === true ? "true" : "false",
            key: column.id,
            scope: "col",
            style: column.width ? { width: column.width } : undefined,
          },
          column.sortable
            ? createElement(
                "button",
                {
                  "data-sort-column-id": column.id,
                  onClick: () =>
                    onSortChange?.({
                      column,
                      sorting: [createNextSort(column, sortDirection)],
                      state,
                    }),
                  type: "button",
                },
                column.header,
              )
            : column.header,
        );
      }),
      state.rowActions.length > 0 ? createElement("th", { scope: "col" }, "Actions") : null,
    ),
  );
}

function renderBody<TData>(
  state: RenderableTableState<TData>,
  onRowAction: AdminDataTableProps<TData>["onRowAction"],
  onSelectionChange: AdminDataTableProps<TData>["onSelectionChange"],
): ReactElement {
  const rows = state.kind === "ready" ? state.rows : [];

  return createElement(
    "tbody",
    null,
    rows.map((row) =>
      createElement(
        "tr",
        { "data-row-id": row.id, key: row.id },
        createElement(
          "td",
          null,
          createElement("input", {
            "aria-label": `Select ${row.id}`,
            checked: state.selectedRowIds.includes(row.id),
            onChange: () => onSelectionChange?.(createSelectionChangeEvent(state, row)),
            type: "checkbox",
          }),
        ),
        state.resource.columns.map((column) =>
          createElement(
            "td",
            { "data-column-id": column.id, key: column.id },
            renderCell(row, column),
          ),
        ),
        state.rowActions.length > 0
          ? createElement(
              "td",
              null,
              state.rowActions.map((action) =>
                renderActionButton(action, {
                  disabledReason: getActionDisabledReason(action, state.grantedPermissions),
                  key: action.id,
                  onClick: () =>
                    onRowAction?.({
                      action,
                      row,
                      state,
                    } satisfies AdminDataTableRowActionEvent<TData>),
                  rowId: row.id,
                  testId: "admin-data-table-row-action",
                }),
              ),
            )
          : null,
      ),
    ),
  );
}

function renderFilterChips<TData>(
  state: RenderableTableState<TData>,
  onFilterChange: AdminDataTableProps<TData>["onFilterChange"],
): ReactElement | null {
  if (state.filters.length === 0) {
    return null;
  }

  return createElement(
    "section",
    { "aria-label": "Active filters", "data-testid": "admin-data-table-filters" },
    state.filters.map((filter) =>
      createElement(
        "button",
        {
          "data-filter-id": filter.id,
          key: filter.id,
          onClick: () =>
            onFilterChange?.({
              filters: state.filters.filter((candidate) => candidate.id !== filter.id),
              state,
            }),
          type: "button",
        },
        `${filter.id}: ${formatValue(filter.value)}`,
      ),
    ),
  );
}

function renderBulkActions<TData>(
  state: RenderableTableState<TData>,
  onBulkAction: AdminDataTableProps<TData>["onBulkAction"],
): ReactElement | null {
  if (state.bulkActions.length === 0) {
    return null;
  }

  const selectedRows = getSelectedRows(state);

  return createElement(
    "section",
    { "aria-label": "Bulk actions", "data-testid": "admin-data-table-bulk-actions" },
    state.bulkActions.map((action) => {
      const disabledReason =
        selectedRows.length === 0
          ? "Select rows before running a bulk action"
          : getActionDisabledReason(action, state.grantedPermissions);

      return renderActionButton(action, {
        disabledReason,
        key: action.id,
        onClick: () =>
          onBulkAction?.({
            action,
            rows: selectedRows,
            selectedRowIds: state.selectedRowIds,
            state,
          } satisfies AdminDataTableBulkActionEvent<TData>),
        testId: "admin-data-table-bulk-action",
      });
    }),
  );
}

function renderPagination<TData>(
  state: RenderableTableState<TData>,
  onPageChange: AdminDataTableProps<TData>["onPageChange"],
): ReactElement | null {
  const pagination = state.pagination;

  if (pagination.mode === "none") {
    return null;
  }

  if (pagination.mode === "offset") {
    const previousOffset = Math.max(0, pagination.offset - pagination.limit);
    const nextOffset = pagination.offset + pagination.limit;

    return createElement(
      "nav",
      {
        "aria-label": "Table pagination",
        "data-testid": "admin-data-table-pagination",
      },
      createElement("span", null, formatOffsetRange(state, nextOffset)),
      createElement(
        "button",
        {
          disabled: !pagination.hasPrevious,
          onClick: () =>
            onPageChange?.(
              createPageChangeEvent(state, {
                limit: pagination.limit,
                mode: "offset",
                offset: previousOffset,
              }),
            ),
          type: "button",
        },
        "Previous",
      ),
      createElement(
        "button",
        {
          disabled: !pagination.hasNext,
          onClick: () =>
            onPageChange?.(
              createPageChangeEvent(state, {
                limit: pagination.limit,
                mode: "offset",
                offset: nextOffset,
              }),
            ),
          type: "button",
        },
        "Next",
      ),
    );
  }

  return createElement(
    "nav",
    {
      "aria-label": "Table pagination",
      "data-testid": "admin-data-table-pagination",
    },
    createElement(
      "button",
      {
        disabled: !pagination.prevCursor,
        onClick: () =>
          pagination.prevCursor
            ? onPageChange?.(
                createPageChangeEvent(state, {
                  cursor: pagination.prevCursor,
                  direction: "backward",
                  limit: pagination.limit ?? state.rows.length,
                  mode: "cursor",
                }),
              )
            : undefined,
        type: "button",
      },
      "Previous",
    ),
    createElement(
      "button",
      {
        disabled: !pagination.nextCursor,
        onClick: () =>
          pagination.nextCursor
            ? onPageChange?.(
                createPageChangeEvent(state, {
                  cursor: pagination.nextCursor,
                  direction: "forward",
                  limit: pagination.limit ?? state.rows.length,
                  mode: "cursor",
                }),
              )
            : undefined,
        type: "button",
      },
      "Next",
    ),
  );
}

function renderRecoveryActions<TData>(
  state: AdminDataTableProblemState<TData>,
  onRecoveryAction: AdminDataTableProps<TData>["onRecoveryAction"],
): ReactElement | null {
  if (state.recoveryActions.length === 0) {
    return null;
  }

  return createElement(
    "section",
    { "aria-label": "Recovery actions", "data-testid": "admin-data-table-recovery-actions" },
    state.recoveryActions.map((action) =>
      renderActionButton(action, {
        disabledReason: getActionDisabledReason(action, state.grantedPermissions),
        key: action.id,
        onClick: () =>
          onRecoveryAction?.({
            action,
            state,
          } satisfies AdminDataTableRecoveryActionEvent<TData>),
        testId: "admin-data-table-recovery-action",
      }),
    ),
  );
}

function renderActionButton(
  action: AdminActionContract,
  options: {
    readonly disabledReason?: string;
    readonly key: string;
    readonly onClick?: () => void;
    readonly rowId?: string;
    readonly testId: string;
  },
): ReactElement {
  return createElement(
    "button",
    {
      "data-action-id": action.id,
      "data-audit-event": action.audit.eventName,
      "data-mutability": action.mutability,
      "data-problem-codes": action.possibleProblems.map((problem) => problem.code).join(","),
      "data-row-id": options.rowId,
      "data-source": action.source,
      "data-testid": options.testId,
      disabled: options.disabledReason !== undefined,
      key: options.key,
      onClick: options.onClick,
      title: options.disabledReason,
      type: "button",
    },
    action.label,
  );
}

function renderCell<TData>(
  row: AdminDataTableRow<TData>,
  column: AdminDataTableColumn<TData>,
): ReactNode {
  const value = getCellValue(row.data, column);

  if (column.render) {
    return createElement(
      Fragment,
      null,
      column.render({ column, row: row.data, rowId: row.id, value }),
    );
  }

  return formatValue(value);
}

function createNextSort<TData>(
  column: AdminDataTableColumn<TData>,
  activeDirection: AdminDataTableSortDirection | undefined,
): AdminDataTableSort<TData> {
  return {
    direction: activeDirection === "asc" ? "desc" : "asc",
    field: column.field,
    id: column.id,
  };
}

function createPageChangeEvent<TData>(
  state: RenderableTableState<TData>,
  pagination: AdminDataTablePageChangeEvent<TData>["pagination"],
): AdminDataTablePageChangeEvent<TData> {
  return { pagination, state };
}

function formatOffsetRange<TData>(state: RenderableTableState<TData>, nextOffset: number): string {
  if (state.pagination.mode !== "offset") {
    return "";
  }

  if (state.rows.length === 0) {
    return `0 of ${state.pagination.total}`;
  }

  return `${state.pagination.offset + 1}-${Math.min(nextOffset, state.pagination.total)} of ${state.pagination.total}`;
}

function createSelectionChangeEvent<TData>(
  state: RenderableTableState<TData>,
  row: AdminDataTableRow<TData>,
): AdminDataTableSelectionChangeEvent<TData> {
  const selectedRowIds = state.selectedRowIds.includes(row.id)
    ? state.selectedRowIds.filter((rowId) => rowId !== row.id)
    : [...state.selectedRowIds, row.id];

  return {
    rows:
      state.kind === "ready"
        ? state.rows.filter((candidate) => selectedRowIds.includes(candidate.id))
        : [],
    selectedRowIds,
    state,
  };
}

function getSelectedRows<TData>(
  state: RenderableTableState<TData>,
): readonly AdminDataTableRow<TData>[] {
  if (state.kind !== "ready") {
    return [];
  }

  return state.rows.filter((row) => state.selectedRowIds.includes(row.id));
}

function getActionDisabledReason(
  action: AdminActionContract,
  grantedPermissions: readonly string[],
): string | undefined {
  if (action.disabledReason) {
    return action.disabledReason;
  }

  const granted = new Set(grantedPermissions);
  const missingPermissions = action.permissions.filter((permission) => !granted.has(permission));

  return missingPermissions.length > 0
    ? `Missing permissions: ${missingPermissions.join(", ")}`
    : undefined;
}

function getCellValue<TData>(row: TData, column: AdminDataTableColumn<TData>): unknown {
  if (column.accessor) {
    return column.accessor(row);
  }

  if (column.field) {
    return row[column.field];
  }

  return undefined;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export type { AdminDataTableState };
