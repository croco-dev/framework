import { describe, expect, expectTypeOf, it } from "vitest";

import {
  DATA_GOVERNANCE_DIAGNOSTIC_CODES,
  DataGovernanceValidationProblem,
  RetentionPolicyViolationProblem,
  UnsupportedDataDeleteProblem,
  UnsupportedDataExportProblem,
  assertDataGovernanceResourcesValid,
  assertRetentionPolicySatisfied,
  createDataMapArtifact,
  defineDataGovernanceResource,
  stringifyDataMapArtifact,
  validateDataGovernanceResources,
} from "../index";
import type {
  DataGovernanceResource,
  DataSubjectDeleteHandler,
  DataSubjectExportHandler,
} from "../index";

const audit = {
  actorId: "privacy-admin",
  idempotencyKey: "privacy-request-1",
  reason: "Subject request DSAR-1",
  ticketId: "DSAR-1",
};

const userResource = defineDataGovernanceResource({
  fields: [
    {
      classifications: ["operational"],
      id: "id",
      label: "ID",
      valueType: "identifier",
    },
    {
      classifications: ["pii"],
      id: "email",
      label: "Email",
      retentionPolicyId: "account-retention",
      valueType: "string",
    },
    {
      classifications: ["billing", "sensitive"],
      deleted: false,
      id: "billingCustomerId",
      label: "Billing customer",
      valueType: "identifier",
    },
  ],
  kind: "user",
  label: "User",
  retentionPolicies: [
    {
      basis: "Customer support and chargeback window",
      disposition: "delete",
      durationDays: 365,
      id: "account-retention",
    },
  ],
  scope: "tenant",
  subject: {
    idField: "id",
    tenantField: "tenantId",
    type: "user",
  },
  subjectRequests: {
    delete: {
      audit: {
        actor: "required",
        eventName: "governance.user.delete",
        idempotencyKey: "required",
        reason: "required",
        subjectType: "user",
      },
      handlerId: "user-delete-handler",
      problems: [
        {
          category: "BusinessRuleViolation",
          code: "governance-core/retention-policy-violation",
          status: 422,
          title: "Business Rule Violation",
        },
      ],
      status: "supported",
    },
    export: {
      audit: {
        actor: "required",
        eventName: "governance.user.export",
        idempotencyKey: "required",
        reason: "required",
        subjectType: "user",
      },
      handlerId: "user-export-handler",
      status: "supported",
    },
  },
});

const auditLogResource = defineDataGovernanceResource({
  fields: [
    {
      classifications: ["audit"],
      deleted: false,
      id: "id",
      valueType: "identifier",
    },
    {
      classifications: ["audit", "operational"],
      deleted: false,
      id: "action",
      valueType: "string",
    },
    {
      classifications: ["audit", "pii"],
      deleted: false,
      id: "actorId",
      valueType: "identifier",
    },
  ],
  kind: "audit-log",
  label: "Audit log",
  retentionPolicies: [
    {
      disposition: "archive",
      durationDays: 2555,
      id: "audit-retention",
    },
  ],
  scope: "tenant",
  subject: {
    idField: "id",
    tenantField: "tenantId",
    type: "audit-log",
  },
  subjectRequests: {
    export: {
      reason: "Audit logs are inspected through compliance evidence exports",
      status: "not-supported",
    },
  },
});

describe("DataGovernanceResource", () => {
  it("models classification, retention, subject export/delete, and audit evidence contracts", () => {
    const resources = [userResource, auditLogResource];

    expect(validateDataGovernanceResources(resources)).toMatchObject({
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectFieldUnknown,
          path: "resources[0].subject.tenantField",
        }),
        expect.objectContaining({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectFieldUnknown,
          path: "resources[1].subject.tenantField",
        }),
      ]),
      valid: false,
    });

    const validResources = [
      {
        ...userResource,
        fields: [
          ...userResource.fields,
          { classifications: ["operational"], id: "tenantId", valueType: "identifier" },
        ],
      },
      {
        ...auditLogResource,
        fields: [
          ...auditLogResource.fields,
          { classifications: ["operational"], id: "tenantId", valueType: "identifier" },
        ],
      },
    ] satisfies readonly [DataGovernanceResource, DataGovernanceResource];

    expect(assertDataGovernanceResourcesValid(validResources)).toBe(validResources);
    expectTypeOf<(typeof validResources)[0]>().toMatchTypeOf<DataGovernanceResource>();

    const exportHandler: DataSubjectExportHandler = {
      exportSubject: (request) => ({
        audit: request.audit,
        exportedAt: "2026-06-21T00:00:00.000Z",
        fields: [{ classifications: ["pii"], id: "email", value: "a@example.com" }],
        resourceKind: request.resourceKind,
        subjectId: request.subjectId,
        subjectType: request.subjectType,
      }),
    };
    const deleteHandler: DataSubjectDeleteHandler = {
      deleteSubject: (request) => ({
        audit: request.audit,
        deletedAt: "2026-06-21T00:00:00.000Z",
        disposition: "delete",
        resourceKind: request.resourceKind,
        subjectId: request.subjectId,
        subjectType: request.subjectType,
      }),
    };

    expect(
      exportHandler.exportSubject({
        audit,
        resourceKind: "user",
        subjectId: "user-1",
        subjectType: "user",
      }),
    ).toMatchObject({ audit });
    expect(
      deleteHandler.deleteSubject({
        audit,
        resourceKind: "user",
        subjectId: "user-1",
        subjectType: "user",
      }),
    ).toMatchObject({ disposition: "delete" });
  });

  it("generates a deterministic Data Map and Project Map section with explicit unsupported capabilities", () => {
    const resources = [
      {
        ...auditLogResource,
        fields: [
          ...auditLogResource.fields,
          { classifications: ["operational"], id: "tenantId", valueType: "identifier" },
        ],
      },
      {
        ...userResource,
        fields: [
          ...userResource.fields,
          { classifications: ["operational"], id: "tenantId", valueType: "identifier" },
        ],
      },
    ] satisfies readonly [DataGovernanceResource, DataGovernanceResource];

    const artifact = createDataMapArtifact(resources, {
      artifactPath: ".croco/build/project-data-map.json",
    });

    expect(artifact).toMatchObject({
      diagnostics: [],
      projectMapSection: {
        artifact: {
          kind: "data-map",
          path: ".croco/build/project-data-map.json",
          version: "croco.data-map.v1",
        },
        id: "data-governance",
      },
      summary: {
        deleteSupported: 1,
        diagnostics: 0,
        exportSupported: 1,
        fields: 8,
        piiFields: 2,
        resources: 2,
        retentionPolicies: 2,
      },
      version: "croco.data-map.v1",
    });
    expect(artifact.resources.map((resource) => resource.kind)).toEqual(["audit-log", "user"]);
    expect(artifact.resources[0]?.capabilities.delete).toEqual({
      problems: [
        {
          category: "NotImplemented",
          code: "governance-core/delete-not-supported",
          status: 501,
          title: "Not Implemented",
        },
      ],
      reason: "Capability is not declared",
      status: "not-supported",
    });
    expect(artifact.resources[0]?.problems.map((problem) => problem.code)).toEqual([
      "governance-core/delete-not-supported",
      "governance-core/export-not-supported",
      "governance-core/retention-policy-violation",
    ]);
    expect(stringifyDataMapArtifact(artifact)).toContain('"version": "croco.data-map.v1"');
    expect(artifact.projectMapSection).toMatchInlineSnapshot(`
      {
        "artifact": {
          "kind": "data-map",
          "path": ".croco/build/project-data-map.json",
          "version": "croco.data-map.v1",
        },
        "id": "data-governance",
        "resources": [
          {
            "classifications": [
              "audit",
              "operational",
              "pii",
            ],
            "delete": "not-supported",
            "export": "not-supported",
            "kind": "audit-log",
            "retentionPolicyIds": [
              "audit-retention",
            ],
            "subjectType": "audit-log",
          },
          {
            "classifications": [
              "billing",
              "operational",
              "pii",
              "sensitive",
            ],
            "delete": "supported",
            "export": "supported",
            "kind": "user",
            "retentionPolicyIds": [
              "account-retention",
            ],
            "subjectType": "user",
          },
        ],
        "summary": {
          "deleteSupported": 1,
          "diagnostics": 0,
          "exportSupported": 1,
          "fields": 8,
          "piiFields": 2,
          "resources": 2,
          "retentionPolicies": 2,
        },
        "title": "Data Governance",
      }
    `);

    const binaryOrderedArtifact = createDataMapArtifact([
      { ...resources[1], kind: "a-resource", label: "A resource" },
      { ...resources[0], kind: "Z-resource", label: "Z resource" },
    ]);
    expect(binaryOrderedArtifact.resources.map((resource) => resource.kind)).toEqual([
      "Z-resource",
      "a-resource",
    ]);
  });

  it("reports invalid governance contracts with stable diagnostics and a typed Problem", () => {
    const invalid = {
      fields: [
        { classifications: [], id: "id" },
        { classifications: ["unknown"], id: "id", retentionPolicyId: "missing" },
        { classifications: ["pii"], id: "" },
      ],
      kind: "",
      label: "",
      retentionPolicies: [
        { disposition: "", durationDays: 0, id: "" },
        { disposition: "delete", durationDays: 10, id: "duplicate" },
        { disposition: "archive", durationDays: 20, id: "duplicate" },
      ],
      scope: "",
      subject: {
        idField: "",
        type: "",
      },
      subjectRequests: {
        delete: {
          reason: "",
          status: "not-supported",
        },
        export: {
          audit: {
            actor: "required",
            eventName: "",
            subjectType: "",
          },
          handlerId: "",
          problems: [{ code: "" }],
          status: "supported",
        },
      },
    } as unknown as DataGovernanceResource;

    const report = validateDataGovernanceResources([invalid]);
    const codes = report.diagnostics.map((diagnostic) => diagnostic.code);

    expect(report.valid).toBe(false);
    expect(codes).toContain(DATA_GOVERNANCE_DIAGNOSTIC_CODES.resourceKindRequired);
    expect(codes).toContain(DATA_GOVERNANCE_DIAGNOSTIC_CODES.resourceLabelRequired);
    expect(codes).toContain(DATA_GOVERNANCE_DIAGNOSTIC_CODES.resourceScopeRequired);
    expect(codes).toContain(DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectTypeRequired);
    expect(codes).toContain(DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectIdFieldRequired);
    expect(codes).toContain(DATA_GOVERNANCE_DIAGNOSTIC_CODES.fieldIdDuplicate);
    expect(codes).toContain(DATA_GOVERNANCE_DIAGNOSTIC_CODES.fieldIdRequired);
    expect(codes).toContain(DATA_GOVERNANCE_DIAGNOSTIC_CODES.fieldClassificationRequired);
    expect(codes).toContain(DATA_GOVERNANCE_DIAGNOSTIC_CODES.fieldClassificationUnknown);
    expect(codes).toContain(DATA_GOVERNANCE_DIAGNOSTIC_CODES.fieldRetentionPolicyUnknown);
    expect(codes).toContain(DATA_GOVERNANCE_DIAGNOSTIC_CODES.retentionPolicyIdRequired);
    expect(codes).toContain(DATA_GOVERNANCE_DIAGNOSTIC_CODES.retentionPolicyIdDuplicate);
    expect(codes).toContain(DATA_GOVERNANCE_DIAGNOSTIC_CODES.retentionPolicyDurationInvalid);
    expect(codes).toContain(DATA_GOVERNANCE_DIAGNOSTIC_CODES.retentionPolicyDispositionRequired);
    expect(codes).toContain(DATA_GOVERNANCE_DIAGNOSTIC_CODES.capabilityHandlerRequired);
    expect(codes).toContain(DATA_GOVERNANCE_DIAGNOSTIC_CODES.capabilityReasonRequired);
    expect(codes).toContain(DATA_GOVERNANCE_DIAGNOSTIC_CODES.capabilityAuditRequired);
    expect(codes).toContain(DATA_GOVERNANCE_DIAGNOSTIC_CODES.problemCodeRequired);

    expect(() => assertDataGovernanceResourcesValid([invalid])).toThrow(
      DataGovernanceValidationProblem,
    );
  });

  it("rejects malformed capability statuses without advertising support in the Data Map", () => {
    const malformedCapabilities = {
      fields: [
        { classifications: ["operational"], id: "id", valueType: "identifier" },
        { classifications: ["operational"], id: "tenantId", valueType: "identifier" },
      ],
      kind: "subject-request-settings",
      label: "Subject request settings",
      scope: "tenant",
      subject: {
        idField: "id",
        tenantField: "tenantId",
        type: "subject-request-settings",
      },
      subjectRequests: {
        delete: {
          reason: "No delete handler exists yet",
        },
        export: {
          reason: "No export handler exists yet",
          status: "unsupported",
        },
      },
    } as unknown as DataGovernanceResource;

    const report = validateDataGovernanceResources([malformedCapabilities]);
    const codes = report.diagnostics.map((diagnostic) => diagnostic.code);

    expect(codes).toContain(DATA_GOVERNANCE_DIAGNOSTIC_CODES.capabilityStatusInvalid);
    expect(codes).toContain(DATA_GOVERNANCE_DIAGNOSTIC_CODES.capabilityStatusRequired);

    const artifact = createDataMapArtifact([malformedCapabilities]);

    expect(artifact.resources[0]?.capabilities.export).toMatchObject({
      reason: "Capability status 'unsupported' is invalid",
      status: "not-supported",
    });
    expect(artifact.resources[0]?.capabilities.delete).toMatchObject({
      reason: "Capability status is not declared",
      status: "not-supported",
    });
  });

  it("surfaces runtime Problems for unsupported export/delete and retention violations with audit evidence", () => {
    const exportProblem = new UnsupportedDataExportProblem({
      audit,
      resourceKind: "audit-log",
      subjectId: "audit-1",
      subjectType: "audit-log",
    });
    const deleteProblem = new UnsupportedDataDeleteProblem({
      audit,
      resourceKind: "audit-log",
      subjectId: "audit-1",
      subjectType: "audit-log",
    });

    expect(exportProblem.toJSON()).toMatchObject({
      audit,
      code: "governance-core/export-not-supported",
      status: 501,
    });
    expect(deleteProblem.toJSON()).toMatchObject({
      audit,
      code: "governance-core/delete-not-supported",
      status: 501,
    });

    expect(() =>
      assertRetentionPolicySatisfied({
        audit,
        policyId: "account-retention",
        requestedAt: "2026-06-21T00:00:00.000Z",
        resourceKind: "user",
        retainedUntil: "2026-07-01T00:00:00.000Z",
        subjectId: "user-1",
        subjectType: "user",
      }),
    ).toThrow(RetentionPolicyViolationProblem);

    try {
      assertRetentionPolicySatisfied({
        audit,
        policyId: "account-retention",
        requestedAt: "2026-06-21T00:00:00.000Z",
        resourceKind: "user",
        retainedUntil: "2026-07-01T00:00:00.000Z",
        subjectId: "user-1",
        subjectType: "user",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(RetentionPolicyViolationProblem);
      if (!(error instanceof RetentionPolicyViolationProblem)) {
        throw error;
      }

      expect(error.toJSON()).toMatchObject({
        audit,
        code: "governance-core/retention-policy-violation",
        policyId: "account-retention",
        status: 422,
      });
    }

    try {
      assertRetentionPolicySatisfied({
        audit,
        policyId: "account-retention",
        requestedAt: "invalid-date",
        resourceKind: "user",
        retainedUntil: "2026-07-01T00:00:00.000Z",
        subjectId: "user-1",
        subjectType: "user",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(RetentionPolicyViolationProblem);
      if (!(error instanceof RetentionPolicyViolationProblem)) {
        throw error;
      }

      expect(error.toJSON()).toMatchObject({
        audit,
        code: "governance-core/retention-policy-violation",
        requestedAt: "invalid-date",
        resourceKind: "user",
        subjectId: "user-1",
      });
    }

    expect(() =>
      assertRetentionPolicySatisfied({
        audit,
        policyId: "account-retention",
        requestedAt: "2026-07-02T00:00:00.000Z",
        resourceKind: "user",
        retainedUntil: "2026-07-01T00:00:00.000Z",
        subjectId: "user-1",
        subjectType: "user",
      }),
    ).not.toThrow();
  });
});
