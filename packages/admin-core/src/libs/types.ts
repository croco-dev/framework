export type NonEmptyArray<T> = readonly [T, ...T[]];

export type AdminResourceScope = "tenant" | "global" | "system" | (string & {});

export type AdminResourceSource = "croco" | "provider" | "external" | (string & {});

export type AdminFieldValueType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "money"
  | "status"
  | "problem"
  | "json"
  | (string & {});

export type AdminSortDirection = "asc" | "desc";

export type AdminActionKind =
  | "inspect"
  | "list"
  | "edit"
  | "retry"
  | "disable"
  | "enable"
  | "delete"
  | "custom"
  | (string & {});

export type AdminActionTarget = "collection" | "record" | "selection";

export type AdminActionMutability = "read" | "write" | "destructive" | "external";

export type AdminPermissionMode = "all" | "any";

export type AdminAuditRequirement = "required" | "optional" | "system";

export type AdminPermissionRequirement = {
  readonly permissions: NonEmptyArray<string>;
  readonly mode?: AdminPermissionMode;
  readonly resource?: string;
  readonly scope?: string;
  readonly condition?: string;
};

export type AdminProblemContract = {
  readonly code: string;
  readonly category?: string;
  readonly status?: number;
  readonly title?: string;
  readonly detail?: string;
  readonly retryable?: boolean;
  readonly recoveryActionId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type AdminAuditDescriptor = {
  readonly eventName: string;
  readonly subjectType: string;
  readonly subjectIdField?: string;
  readonly actor: AdminAuditRequirement;
  readonly reason?: Extract<AdminAuditRequirement, "required" | "optional">;
  readonly idempotencyKey?: Extract<AdminAuditRequirement, "required" | "optional">;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type AdminResourceIdentity = {
  readonly idField: string;
  readonly labelField?: string;
  readonly tenantField?: string;
  readonly statusField?: string;
  readonly versionField?: string;
  readonly subjectType?: string;
};

export type AdminResourceField = {
  readonly id: string;
  readonly label: string;
  readonly valueType: AdminFieldValueType;
  readonly source?: AdminResourceSource;
  readonly description?: string;
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly sensitive?: boolean;
  readonly problemCode?: string;
};

export type AdminResourceListDescriptor = {
  readonly fields: NonEmptyArray<string>;
  readonly filters?: readonly string[];
  readonly defaultSort?: {
    readonly field: string;
    readonly direction: AdminSortDirection;
  };
  readonly pageSize?: number;
};

export type AdminResourceSection = {
  readonly id: string;
  readonly label: string;
  readonly fields: NonEmptyArray<string>;
};

export type AdminResourceDetailDescriptor = {
  readonly fields: NonEmptyArray<string>;
  readonly sections?: readonly AdminResourceSection[];
};

export type AdminActionRecoveryDescriptor = {
  readonly retryable?: boolean;
  readonly successState?: string;
  readonly failureState?: string;
};

export type AdminAction = {
  readonly id: string;
  readonly label: string;
  readonly kind: AdminActionKind;
  readonly target: AdminActionTarget;
  readonly mutability: AdminActionMutability;
  readonly permissions: NonEmptyArray<AdminPermissionRequirement>;
  readonly audit: AdminAuditDescriptor;
  readonly problems: NonEmptyArray<AdminProblemContract>;
  readonly idempotency?: Extract<AdminAuditRequirement, "required" | "optional"> | "not-supported";
  readonly disabledWhen?: string;
  readonly recovery?: AdminActionRecoveryDescriptor;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type AdminResource = {
  readonly kind: string;
  readonly label: string;
  readonly scope: AdminResourceScope;
  readonly source: AdminResourceSource;
  readonly identity: AdminResourceIdentity;
  readonly fields: NonEmptyArray<AdminResourceField>;
  readonly list: AdminResourceListDescriptor;
  readonly detail: AdminResourceDetailDescriptor;
  readonly actions: readonly AdminAction[];
  readonly description?: string;
  readonly problems?: readonly AdminProblemContract[];
  readonly metadata?: Readonly<Record<string, unknown>>;
};
