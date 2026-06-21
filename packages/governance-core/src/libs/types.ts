export type NonEmptyArray<T> = readonly [T, ...T[]];

export type DataClassificationTag = "pii" | "sensitive" | "operational" | "billing" | "audit";

export type DataGovernanceScope = "tenant" | "global" | "system" | (string & {});

export type DataFieldValueType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "money"
  | "json"
  | "identifier"
  | (string & {});

export type DataRetentionDisposition = "delete" | "anonymize" | "archive" | "manual-review";

export type DataRetentionPolicy = {
  readonly id: string;
  readonly durationDays: number;
  readonly disposition: DataRetentionDisposition;
  readonly basis?: string;
  readonly startsFrom?: string;
  readonly legalHold?: "block-delete" | "preserve";
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type DataSubjectIdentity = {
  readonly type: string;
  readonly idField: string;
  readonly tenantField?: string;
  readonly labelField?: string;
};

export type DataGovernanceField = {
  readonly id: string;
  readonly classifications: NonEmptyArray<DataClassificationTag>;
  readonly label?: string;
  readonly valueType?: DataFieldValueType;
  readonly retentionPolicyId?: string;
  readonly exported?: boolean;
  readonly deleted?: boolean;
  readonly source?: "croco" | "provider" | "external" | (string & {});
  readonly description?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type DataGovernanceProblemContract = {
  readonly code: string;
  readonly category?: string;
  readonly status?: number;
  readonly title?: string;
  readonly detail?: string;
  readonly retryable?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type DataGovernanceAuditRequirement = "required" | "optional" | "system";

export type DataGovernanceAuditDescriptor = {
  readonly eventName: string;
  readonly subjectType: string;
  readonly actor: DataGovernanceAuditRequirement;
  readonly reason?: Extract<DataGovernanceAuditRequirement, "required" | "optional">;
  readonly idempotencyKey?: Extract<DataGovernanceAuditRequirement, "required" | "optional">;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type DataSubjectCapabilityDeclaration =
  | {
      readonly status: "supported";
      readonly handlerId: string;
      readonly audit: DataGovernanceAuditDescriptor;
      readonly problems?: readonly DataGovernanceProblemContract[];
      readonly metadata?: Readonly<Record<string, unknown>>;
    }
  | {
      readonly status: "not-supported";
      readonly reason: string;
      readonly audit?: DataGovernanceAuditDescriptor;
      readonly problems?: readonly DataGovernanceProblemContract[];
      readonly metadata?: Readonly<Record<string, unknown>>;
    };

export type DataGovernanceResource = {
  readonly kind: string;
  readonly label: string;
  readonly scope: DataGovernanceScope;
  readonly subject: DataSubjectIdentity;
  readonly fields: NonEmptyArray<DataGovernanceField>;
  readonly retentionPolicies?: readonly DataRetentionPolicy[];
  readonly subjectRequests?: {
    readonly export?: DataSubjectCapabilityDeclaration;
    readonly delete?: DataSubjectCapabilityDeclaration;
  };
  readonly problems?: readonly DataGovernanceProblemContract[];
  readonly description?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type DataSubjectRequestAuditEvidence = {
  readonly actorId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly eventName?: string;
  readonly ticketId?: string;
  readonly auditLogEntryId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type DataSubjectRequestBase = {
  readonly resourceKind: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly tenantId?: string | null;
  readonly audit: DataSubjectRequestAuditEvidence;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type DataSubjectExportRequest = DataSubjectRequestBase & {
  readonly fieldIds?: readonly string[];
};

export type DataSubjectDeleteRequest = DataSubjectRequestBase & {
  readonly mode?: "delete" | "anonymize" | "archive";
  readonly retentionPolicyIds?: readonly string[];
};

export type DataSubjectExportResult = {
  readonly resourceKind: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly exportedAt: string;
  readonly fields: readonly {
    readonly id: string;
    readonly classifications: readonly DataClassificationTag[];
    readonly value: unknown;
  }[];
  readonly audit: DataSubjectRequestAuditEvidence;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type DataSubjectDeleteResult = {
  readonly resourceKind: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly deletedAt: string;
  readonly disposition: DataRetentionDisposition;
  readonly audit: DataSubjectRequestAuditEvidence;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type DataSubjectExportHandler<TResult = DataSubjectExportResult> = {
  exportSubject(request: DataSubjectExportRequest): Promise<TResult> | TResult;
};

export type DataSubjectDeleteHandler<TResult = DataSubjectDeleteResult> = {
  deleteSubject(request: DataSubjectDeleteRequest): Promise<TResult> | TResult;
};

export type RetentionPolicyCheck = {
  readonly resourceKind: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly policyId: string;
  readonly retainedUntil: Date | string;
  readonly requestedAt: Date | string;
  readonly audit: DataSubjectRequestAuditEvidence;
};

export type DataMapVersion = "croco.data-map.v1";

export type DataMapProblemContract = Required<
  Pick<DataGovernanceProblemContract, "code" | "category" | "status" | "title">
> &
  Pick<DataGovernanceProblemContract, "detail" | "retryable" | "metadata">;

export type DataMapCapability = {
  readonly status: "supported" | "not-supported";
  readonly handlerId?: string;
  readonly reason?: string;
  readonly audit?: DataGovernanceAuditDescriptor;
  readonly problems: readonly DataMapProblemContract[];
};

export type DataMapField = {
  readonly id: string;
  readonly classifications: readonly DataClassificationTag[];
  readonly exported: boolean;
  readonly deleted: boolean;
  readonly label?: string;
  readonly valueType?: DataFieldValueType;
  readonly retentionPolicyId?: string;
  readonly source?: string;
  readonly description?: string;
};

export type DataMapResource = {
  readonly kind: string;
  readonly label: string;
  readonly scope: DataGovernanceScope;
  readonly subject: DataSubjectIdentity;
  readonly classifications: readonly DataClassificationTag[];
  readonly fields: readonly DataMapField[];
  readonly retentionPolicies: readonly DataRetentionPolicy[];
  readonly capabilities: {
    readonly export: DataMapCapability;
    readonly delete: DataMapCapability;
  };
  readonly problems: readonly DataMapProblemContract[];
  readonly description?: string;
};

export type DataMapSummary = {
  readonly resources: number;
  readonly fields: number;
  readonly piiFields: number;
  readonly retentionPolicies: number;
  readonly exportSupported: number;
  readonly deleteSupported: number;
  readonly diagnostics: number;
};

export type DataMapProjectSection = {
  readonly id: "data-governance";
  readonly title: "Data Governance";
  readonly artifact: {
    readonly kind: "data-map";
    readonly path: string;
    readonly version: DataMapVersion;
  };
  readonly summary: DataMapSummary;
  readonly resources: readonly {
    readonly kind: string;
    readonly subjectType: string;
    readonly classifications: readonly DataClassificationTag[];
    readonly retentionPolicyIds: readonly string[];
    readonly export: DataMapCapability["status"];
    readonly delete: DataMapCapability["status"];
  }[];
};

export type DataMapArtifact = {
  readonly version: DataMapVersion;
  readonly summary: DataMapSummary;
  readonly resources: readonly DataMapResource[];
  readonly projectMapSection: DataMapProjectSection;
  readonly diagnostics: readonly {
    readonly code: string;
    readonly path: string;
    readonly message: string;
    readonly resourceKind?: string;
  }[];
};
