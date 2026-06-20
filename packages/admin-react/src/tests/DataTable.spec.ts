import type { SearchResult } from "@croco/search-core";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AdminDataTable } from "../libs/DataTable";
import {
  createAdminDataTableListResult,
  createAdminDataTableListResultFromOffsetPage,
  createAdminDataTableListResultFromSearchResult,
  createAdminDataTableState,
} from "../libs/dataTableSnapshot";
import type {
  AdminDataTableListQuery,
  AdminDataTableResource,
  AdminDataTableState,
} from "../libs/dataTableTypes";
import { createCoreProblemDetails } from "../libs/snapshot";
import type { AdminActionContract } from "../libs/types";

type AdminUser = {
  readonly createdAt: Date;
  readonly email: string;
  readonly id: string;
  readonly name: string;
  readonly status: "active" | "invited" | "suspended";
};

const generatedAt = new Date("2026-06-20T00:00:00.000Z");

const generatedClientUsers: AdminUser[] = [
  {
    createdAt: generatedAt,
    email: "ada@example.com",
    id: "user-1",
    name: "Ada Lovelace",
    status: "active",
  },
  {
    createdAt: generatedAt,
    email: "grace@example.com",
    id: "user-2",
    name: "Grace Hopper",
    status: "invited",
  },
];

const viewUserAction: AdminActionContract = {
  audit: {
    eventName: "admin.user.viewed",
    subjectId: "users",
    subjectType: "tenant",
  },
  id: "view-user",
  label: "View",
  mutability: "read-only",
  permissions: ["users:read"],
  possibleProblems: [{ code: "admin/user-not-found", source: "permissions" }],
  source: "croco",
};

const archiveUsersAction: AdminActionContract = {
  audit: {
    eventName: "admin.users.archived",
    subjectId: "users",
    subjectType: "tenant",
  },
  id: "archive-users",
  label: "Archive",
  mutability: "editable",
  permissions: ["users:write"],
  possibleProblems: [{ code: "admin/user-archive-failed", source: "permissions" }],
  source: "croco",
};

const retryLoadAction: AdminActionContract = {
  audit: {
    eventName: "admin.users.reload_requested",
    subjectId: "users",
    subjectType: "tenant",
  },
  id: "retry-users",
  label: "Retry",
  mutability: "read-only",
  permissions: ["users:read"],
  possibleProblems: [{ code: "admin/users-unavailable", source: "provider" }],
  source: "croco",
};

const generatedAdminClient = {
  users: {
    async list(query: AdminDataTableListQuery<AdminUser>) {
      const limit = query.pagination?.mode === "offset" ? query.pagination.limit : 25;
      const offset = query.pagination?.mode === "offset" ? query.pagination.offset : 0;

      return {
        data: generatedClientUsers.slice(offset, offset + limit),
        limit,
        offset,
        total: 42,
      };
    },
  },
};

const usersResource: AdminDataTableResource<AdminUser> = {
  bulkActions: [archiveUsersAction],
  columns: [
    { field: "email", filterable: true, header: "Email", id: "email", sortable: true },
    { field: "status", filterable: true, header: "Status", id: "status", sortable: true },
    {
      accessor: (user) => user.createdAt,
      header: "Created",
      id: "created",
    },
  ],
  filters: [
    { defaultValue: "active", field: "status", id: "status", label: "Status", operator: "equals" },
  ],
  id: "users",
  label: "Users",
  list: {
    generatedClient: "admin.users.list",
    load: async (query) =>
      createAdminDataTableListResultFromOffsetPage(await generatedAdminClient.users.list(query), {
        source: "generated-client",
      }),
    queryKey: ["admin", "users"],
  },
  requiredPermissions: ["users:read"],
  rowActions: [viewUserAction],
  rowId: (user) => user.id,
};

function renderState(state: AdminDataTableState<AdminUser>): string {
  return renderToStaticMarkup(AdminDataTable({ state }));
}

function collectElements(node: ReactNode, type?: string): ReactElement<Record<string, unknown>>[] {
  const result: ReactElement<Record<string, unknown>>[] = [];
  const nodes = Array.isArray(node) ? node : [node];

  for (const candidate of nodes) {
    if (Array.isArray(candidate)) {
      result.push(...collectElements(candidate, type));
      continue;
    }

    if (!isValidElement<Record<string, unknown>>(candidate)) {
      continue;
    }

    if (type === undefined || candidate.type === type) {
      result.push(candidate);
    }

    result.push(...collectElements(candidate.props.children as ReactNode, type));
  }

  return result;
}

function findElementByProp(
  elements: readonly ReactElement<Record<string, unknown>>[],
  name: string,
  value: unknown,
): ReactElement<Record<string, unknown>> {
  const element = elements.find((candidate) => candidate.props[name] === value);
  expect(element).toBeDefined();
  return element as ReactElement<Record<string, unknown>>;
}

function findElementByText(
  elements: readonly ReactElement<Record<string, unknown>>[],
  text: string,
): ReactElement<Record<string, unknown>> {
  const element = elements.find((candidate) => candidate.props.children === text);
  expect(element).toBeDefined();
  return element as ReactElement<Record<string, unknown>>;
}

function invokeHandler(element: ReactElement<Record<string, unknown>>, name: string): void {
  const handler = element.props[name];
  expect(typeof handler).toBe("function");

  if (typeof handler === "function") {
    handler();
  }
}

describe("AdminDataTable", () => {
  it("builds typed generated-client table state with stable row ids and list contracts", async () => {
    const loaded = await usersResource.list?.load?.({
      filters: [{ field: "status", id: "status-active", operator: "equals", value: "active" }],
      pagination: { limit: 2, mode: "offset", offset: 0 },
      search: { query: "ada" },
      sorting: [{ direction: "asc", field: "email", id: "email" }],
    });
    expect(loaded?.source).toBe("generated-client");

    const state = createAdminDataTableState({
      filters: [{ field: "status", id: "status-active", operator: "equals", value: "active" }],
      generatedAt,
      grantedPermissions: ["users:read", "users:write"],
      result: loaded,
      resource: usersResource,
      selectedRowIds: ["user-1"],
      sorting: [{ direction: "asc", field: "email", id: "email" }],
    });

    expect(state.kind).toBe("ready");
    if (state.kind !== "ready") {
      return;
    }

    expect(state.rows.map((row) => row.id)).toEqual(["user-1", "user-2"]);
    expect(state.total).toBe(42);
    expect(state.pagination).toMatchObject({ mode: "offset", hasNext: true, hasPrevious: false });

    const markup = renderState(state);
    expect(markup).toContain('data-testid="admin-data-table"');
    expect(markup).toContain('data-source="generated-client"');
    expect(markup).toContain('data-row-id="user-1"');
    expect(markup).toContain('data-sort-direction="asc"');
    expect(markup).toContain('data-filter-id="status-active"');
    expect(markup).toContain('data-action-id="view-user"');
    expect(markup).toContain('data-action-id="archive-users"');
  });

  it("dispatches row, bulk, sort, filter, page, and selection callbacks without a browser server", () => {
    const state = createAdminDataTableState({
      filters: [{ field: "status", id: "status-active", operator: "equals", value: "active" }],
      grantedPermissions: ["users:read", "users:write"],
      result: createAdminDataTableListResultFromOffsetPage(
        { data: generatedClientUsers, limit: 2, offset: 0, total: 42 },
        { source: "generated-client" },
      ),
      resource: usersResource,
      selectedRowIds: ["user-1"],
      sorting: [{ direction: "asc", field: "email", id: "email" }],
    });
    expect(state.kind).toBe("ready");
    if (state.kind !== "ready") {
      return;
    }

    const events: string[] = [];
    const element = AdminDataTable({
      onBulkAction: (event) => events.push(`bulk:${event.action.id}:${event.rows.length}`),
      onFilterChange: (event) => events.push(`filter:${event.filters.length}`),
      onPageChange: (event) =>
        events.push(
          `page:${event.pagination.mode}:${event.pagination.mode === "offset" ? event.pagination.offset : event.pagination.cursor}`,
        ),
      onRowAction: (event) => events.push(`row:${event.action.id}:${event.row.id}`),
      onSelectionChange: (event) => events.push(`select:${event.selectedRowIds.join(",")}`),
      onSortChange: (event) =>
        events.push(`sort:${event.sorting[0]?.id}:${event.sorting[0]?.direction}`),
      state,
    });
    const buttons = collectElements(element, "button");
    const inputs = collectElements(element, "input");

    invokeHandler(findElementByProp(buttons, "data-action-id", "view-user"), "onClick");
    invokeHandler(findElementByProp(buttons, "data-action-id", "archive-users"), "onClick");
    invokeHandler(findElementByProp(buttons, "data-sort-column-id", "email"), "onClick");
    invokeHandler(findElementByProp(buttons, "data-filter-id", "status-active"), "onClick");
    invokeHandler(findElementByText(buttons, "Next"), "onClick");
    invokeHandler(findElementByProp(inputs, "aria-label", "Select user-2"), "onChange");

    expect(events).toEqual([
      "row:view-user:user-1",
      "bulk:archive-users:1",
      "sort:email:desc",
      "filter:0",
      "page:offset:2",
      "select:user-1,user-2",
    ]);
  });

  it("preserves Problem details and recovery actions instead of rendering empty success", () => {
    const problem = createCoreProblemDetails({
      code: "admin/users-unavailable",
      detail: "Generated user client failed while loading tenants",
      source: "provider",
      status: 503,
      title: "Service Unavailable",
    });
    const state = createAdminDataTableState({
      grantedPermissions: ["users:read"],
      recoveryActions: [retryLoadAction],
      resource: usersResource,
      result: createAdminDataTableListResult(generatedClientUsers, {
        problem,
        source: "generated-client",
      }),
    });

    expect(state.kind).toBe("problem");
    if (state.kind !== "problem") {
      return;
    }

    expect(state.problem).toBe(problem);
    expect(state.partialRows.map((row) => row.id)).toEqual(["user-1", "user-2"]);

    const markup = renderState(state);
    expect(markup).toContain('data-testid="admin-data-table-problem"');
    expect(markup).toContain('data-problem-code="admin/users-unavailable"');
    expect(markup).toContain("Generated user client failed");
    expect(markup).toContain('data-testid="admin-data-table-recovery-action"');
    expect(markup).not.toContain('data-state="empty"');

    const events: string[] = [];
    const element = AdminDataTable({
      onRecoveryAction: (event) => events.push(`recovery:${event.action.id}:${event.state.kind}`),
      state,
    });
    const recoveryButtons = collectElements(element, "button");

    invokeHandler(findElementByProp(recoveryButtons, "data-action-id", "retry-users"), "onClick");

    expect(events).toEqual(["recovery:retry-users:problem"]);
  });

  it("keeps permission denial distinct from empty data", () => {
    const deniedState = createAdminDataTableState({
      grantedPermissions: [],
      resource: usersResource,
      rows: [],
    });
    expect(deniedState.kind).toBe("permission_denied");

    const deniedMarkup = renderState(deniedState);
    expect(deniedMarkup).toContain('data-testid="admin-data-table-permission-denied"');
    expect(deniedMarkup).toContain("admin-table/permission-denied");
    expect(deniedMarkup).not.toContain("No Users found");

    const emptyState = createAdminDataTableState({
      grantedPermissions: ["users:read"],
      resource: usersResource,
      rows: [],
    });
    expect(emptyState.kind).toBe("empty");

    const emptyMarkup = renderState(emptyState);
    expect(emptyMarkup).toContain('data-state="empty"');
    expect(emptyMarkup).toContain("No Users found");
    expect(emptyMarkup).not.toContain("admin-table/permission-denied");
  });

  it("preserves nonzero totals for empty paginated pages", () => {
    const state = createAdminDataTableState({
      grantedPermissions: ["users:read"],
      result: createAdminDataTableListResultFromOffsetPage(
        { data: [], limit: 2, offset: 42, total: 42 },
        { source: "generated-client" },
      ),
      resource: usersResource,
    });

    expect(state.kind).toBe("empty");
    if (state.kind !== "empty") {
      return;
    }

    expect(state.total).toBe(42);
    expect(state.pagination).toMatchObject({
      hasNext: false,
      hasPrevious: true,
      limit: 2,
      mode: "offset",
      offset: 42,
      total: 42,
    });

    const markup = renderState(state);
    expect(markup).toContain("0 of 42");
    expect(markup).not.toContain("43-42 of 42");
  });

  it("converts search results and rejects unstable duplicate row ids as a Problem state", () => {
    const searchResult: SearchResult<AdminUser> = {
      hits: [{ document: generatedClientUsers[0], score: 0.9 }],
      processingTimeMs: 12,
      query: { filters: { status: "active" }, query: "ada" },
      total: 1,
    };
    const searchListResult = createAdminDataTableListResultFromSearchResult(searchResult);
    expect(searchListResult).toMatchObject({
      search: { query: "ada" },
      source: "search-result",
      total: 1,
    });

    const duplicateState = createAdminDataTableState({
      grantedPermissions: ["users:read"],
      resource: usersResource,
      rows: [generatedClientUsers[0], generatedClientUsers[0]],
    });

    expect(duplicateState.kind).toBe("problem");
    if (duplicateState.kind !== "problem") {
      return;
    }

    expect(duplicateState.problem.code).toBe("admin-table/invalid-row-id");
    expect(duplicateState.problem.detail).toContain("duplicate 'user-1'");
  });
});
