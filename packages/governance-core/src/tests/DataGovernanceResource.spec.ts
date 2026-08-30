import { createHash } from "node:crypto";

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

  it("requires an identifier tenant field only for tenant-scoped resources", () => {
    const resource = {
      fields: [
        { classifications: ["operational"], id: "id", valueType: "identifier" },
        { classifications: ["operational"], id: "tenantId", valueType: "identifier" },
      ],
      kind: "account",
      label: "Account",
      subject: {
        idField: "id",
        type: "account",
      },
    } as const;

    const tenantWithoutField = {
      ...resource,
      scope: "tenant",
    } satisfies DataGovernanceResource;
    const tenantWithUnknownField = {
      ...tenantWithoutField,
      subject: { ...resource.subject, tenantField: "workspaceId" },
    } satisfies DataGovernanceResource;
    const tenantWithNonIdentifierField = {
      ...tenantWithoutField,
      fields: [resource.fields[0], { ...resource.fields[1], valueType: "string" }],
      subject: { ...resource.subject, tenantField: "tenantId" },
    } satisfies DataGovernanceResource;
    const tenantWithPaddedReference = {
      ...tenantWithoutField,
      subject: { ...resource.subject, tenantField: " tenantId " },
    } satisfies DataGovernanceResource;
    const tenantWithPaddedFieldId = {
      ...tenantWithoutField,
      fields: [resource.fields[0], { ...resource.fields[1], id: " tenantId " }],
      subject: { ...resource.subject, tenantField: "tenantId" },
    } satisfies DataGovernanceResource;
    const tenantWithPaddedValueType = {
      ...tenantWithoutField,
      fields: [resource.fields[0], { ...resource.fields[1], valueType: " identifier " }],
      subject: { ...resource.subject, tenantField: "tenantId" },
    } satisfies DataGovernanceResource;
    const tenantWithDocumentedOverride = {
      ...tenantWithoutField,
      fields: [
        resource.fields[0],
        {
          ...resource.fields[1],
          valueType: "uuid",
        },
      ],
      subject: {
        ...resource.subject,
        tenantField: "tenantId",
        tenantIdentifierOverride: { reason: "Provider tenant keys use canonical UUID strings" },
      },
    } satisfies DataGovernanceResource;
    const tenantWithUndocumentedOverride = {
      ...tenantWithDocumentedOverride,
      subject: {
        ...tenantWithDocumentedOverride.subject,
        tenantIdentifierOverride: { reason: " " },
      },
    } satisfies DataGovernanceResource;
    const tenantWithMalformedOverride = {
      ...tenantWithoutField,
      subject: {
        ...resource.subject,
        tenantField: "tenantId",
        tenantIdentifierOverride: { reason: 123 },
      },
    } as unknown as DataGovernanceResource;
    const tenantWithMissingOverrideReason = {
      ...tenantWithoutField,
      subject: {
        ...resource.subject,
        tenantField: "tenantId",
        tenantIdentifierOverride: {},
      },
    } as unknown as DataGovernanceResource;
    const globalResource = {
      ...resource,
      scope: "global",
    } satisfies DataGovernanceResource;
    const systemResource = {
      ...resource,
      scope: "system",
    } satisfies DataGovernanceResource;
    const validTenantResource = {
      ...tenantWithoutField,
      subject: { ...resource.subject, tenantField: "tenantId" },
    } satisfies DataGovernanceResource;

    expect(validateDataGovernanceResources([tenantWithoutField])).toMatchObject({
      diagnostics: [
        {
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectTenantFieldRequired,
          path: "resources[0].subject.tenantField",
        },
      ],
      valid: false,
    });
    expect(validateDataGovernanceResources([tenantWithUnknownField])).toMatchObject({
      diagnostics: [
        {
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectFieldUnknown,
          path: "resources[0].subject.tenantField",
        },
      ],
      valid: false,
    });
    expect(validateDataGovernanceResources([tenantWithNonIdentifierField])).toMatchObject({
      diagnostics: [
        {
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectTenantFieldTypeInvalid,
          path: "resources[0].fields[1].valueType",
        },
      ],
      valid: false,
    });
    for (const paddedResource of [tenantWithPaddedReference, tenantWithPaddedFieldId]) {
      expect(validateDataGovernanceResources([paddedResource])).toMatchObject({
        diagnostics: [
          {
            code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectFieldUnknown,
            path: "resources[0].subject.tenantField",
          },
        ],
        valid: false,
      });
    }
    expect(validateDataGovernanceResources([tenantWithPaddedValueType])).toMatchObject({
      diagnostics: [
        {
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectTenantFieldTypeInvalid,
          path: "resources[0].fields[1].valueType",
        },
      ],
      valid: false,
    });
    expect(validateDataGovernanceResources([tenantWithDocumentedOverride])).toEqual({
      diagnostics: [],
      valid: true,
    });
    expect(validateDataGovernanceResources([tenantWithUndocumentedOverride])).toMatchObject({
      diagnostics: [
        {
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectTenantIdentifierOverrideReasonRequired,
          path: "resources[0].subject.tenantIdentifierOverride.reason",
        },
      ],
      valid: false,
    });
    for (const malformedOverride of [
      tenantWithMalformedOverride,
      tenantWithMissingOverrideReason,
    ]) {
      expect(validateDataGovernanceResources([malformedOverride])).toMatchObject({
        diagnostics: [
          {
            code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectTenantIdentifierOverrideReasonRequired,
            path: "resources[0].subject.tenantIdentifierOverride.reason",
          },
        ],
        valid: false,
      });
      expect(() => assertDataGovernanceResourcesValid([malformedOverride])).toThrow(
        DataGovernanceValidationProblem,
      );
      expect(createDataMapArtifact([malformedOverride])).toMatchObject({
        diagnostics: [
          {
            code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectTenantIdentifierOverrideReasonRequired,
            path: "resources[0].subject.tenantIdentifierOverride.reason",
          },
        ],
        summary: { diagnostics: 1 },
      });
    }
    expect(
      createDataMapArtifact([tenantWithUndocumentedOverride]).resources[0]?.subject,
    ).not.toHaveProperty("tenantIdentifierOverride");
    expect(validateDataGovernanceResources([globalResource, systemResource])).toEqual({
      diagnostics: [],
      valid: true,
    });

    expect(createDataMapArtifact([tenantWithoutField])).toMatchObject({
      diagnostics: [
        {
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectTenantFieldRequired,
          path: "resources[0].subject.tenantField",
        },
      ],
      summary: { diagnostics: 1 },
    });

    const artifact = createDataMapArtifact([validTenantResource]);

    expect(artifact.diagnostics).toEqual([]);
    expect(artifact.resources[0]).toMatchObject({
      fields: validTenantResource.fields,
      scope: "tenant",
      subject: validTenantResource.subject,
    });
    expect(
      createDataMapArtifact([tenantWithDocumentedOverride]).resources[0]?.subject,
    ).toMatchObject({
      tenantIdentifierOverride: tenantWithDocumentedOverride.subject.tenantIdentifierOverride,
    });
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
    expect(createHash("sha256").update(stringifyDataMapArtifact(artifact)).digest("hex")).toBe(
      "c66171da6cb91996c33933eaca3d9b2b39766a6b4f615a6dc456eb2e5133eb56",
    );
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

  it("aligns Data Map field flags with supported, unsupported, and mixed capabilities", () => {
    const supportedResource = defineDataGovernanceResource({
      fields: [
        { classifications: ["operational"], id: "id", valueType: "identifier" },
        {
          classifications: ["sensitive"],
          deleted: false,
          exported: false,
          id: "excluded",
        },
      ],
      kind: "supported",
      label: "Supported",
      scope: "tenant",
      subject: { idField: "id", tenantField: "id", type: "supported" },
      subjectRequests: userResource.subjectRequests,
    });
    const unsupportedResource = defineDataGovernanceResource({
      fields: [{ classifications: ["operational"], id: "id", valueType: "identifier" }],
      kind: "unsupported",
      label: "Unsupported",
      scope: "tenant",
      subject: { idField: "id", tenantField: "id", type: "unsupported" },
    });
    const mixedResource = defineDataGovernanceResource({
      fields: [
        { classifications: ["operational"], id: "id", valueType: "identifier" },
        { classifications: ["sensitive"], exported: false, id: "excluded" },
      ],
      kind: "mixed",
      label: "Mixed",
      scope: "tenant",
      subject: { idField: "id", tenantField: "id", type: "mixed" },
      subjectRequests: {
        delete: { reason: "Deletion is not available", status: "not-supported" },
        export: userResource.subjectRequests.export,
      },
    });

    const artifact = createDataMapArtifact([unsupportedResource, supportedResource, mixedResource]);

    expect(artifact.diagnostics).toEqual([]);
    expect(
      artifact.resources.map((resource) => ({
        capabilities: {
          delete: resource.capabilities.delete.status,
          export: resource.capabilities.export.status,
        },
        fields: resource.fields.map(({ deleted, exported, id }) => ({ deleted, exported, id })),
        kind: resource.kind,
      })),
    ).toMatchInlineSnapshot(`
      [
        {
          "capabilities": {
            "delete": "not-supported",
            "export": "supported",
          },
          "fields": [
            {
              "deleted": false,
              "exported": false,
              "id": "excluded",
            },
            {
              "deleted": false,
              "exported": true,
              "id": "id",
            },
          ],
          "kind": "mixed",
        },
        {
          "capabilities": {
            "delete": "supported",
            "export": "supported",
          },
          "fields": [
            {
              "deleted": false,
              "exported": false,
              "id": "excluded",
            },
            {
              "deleted": true,
              "exported": true,
              "id": "id",
            },
          ],
          "kind": "supported",
        },
        {
          "capabilities": {
            "delete": "not-supported",
            "export": "not-supported",
          },
          "fields": [
            {
              "deleted": false,
              "exported": false,
              "id": "id",
            },
          ],
          "kind": "unsupported",
        },
      ]
    `);
  });

  it("fails closed for malformed field capability flags without disabling valid capabilities", () => {
    const malformed = {
      ...userResource,
      fields: [
        { ...userResource.fields[0], deleted: 0, exported: "false" },
        ...userResource.fields.slice(1),
        { classifications: ["operational"], id: "tenantId", valueType: "identifier" },
      ],
    } as unknown as DataGovernanceResource;

    const report = validateDataGovernanceResources([malformed]);
    const artifact = createDataMapArtifact([malformed]);

    expect(report.diagnostics).toEqual(
      expect.arrayContaining(
        ["deleted", "exported"].map((field) =>
          expect.objectContaining({
            code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.valueInvalid,
            path: `resources[0].fields[0].${field}`,
          }),
        ),
      ),
    );
    expect(artifact.resources[0]?.capabilities).toMatchObject({
      delete: { status: "supported" },
      export: { status: "supported" },
    });
    expect(artifact.resources[0]?.fields.find((field) => field.id === "id")).toMatchObject({
      deleted: false,
      exported: false,
    });
  });

  it("rejects field flags that advertise unsupported resource capabilities", () => {
    const contradictoryResource = defineDataGovernanceResource({
      fields: [
        {
          classifications: ["operational"],
          deleted: true,
          exported: true,
          id: "id",
          valueType: "identifier",
        },
      ],
      kind: "contradictory",
      label: "Contradictory",
      scope: "tenant",
      subject: { idField: "id", tenantField: "id", type: "contradictory" },
      subjectRequests: {
        delete: { reason: "Deletion is not available", status: "not-supported" },
        export: { reason: "Export is not available", status: "not-supported" },
      },
    });

    const report = validateDataGovernanceResources([contradictoryResource]);

    expect(report).toMatchObject({
      diagnostics: [
        {
          capability: "delete",
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.fieldCapabilityUnsupported,
          fieldId: "id",
          path: "resources[0].fields[0].deleted",
        },
        {
          capability: "export",
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.fieldCapabilityUnsupported,
          fieldId: "id",
          path: "resources[0].fields[0].exported",
        },
      ],
      valid: false,
    });
    expect(createDataMapArtifact([contradictoryResource])).toMatchObject({
      diagnostics: [
        { code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.fieldCapabilityUnsupported },
        { code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.fieldCapabilityUnsupported },
      ],
      resources: [{ fields: [{ deleted: false, exported: false, id: "id" }] }],
    });
  });

  it("preserves validator-valid optional subject strings byte-for-byte", () => {
    const resource = defineDataGovernanceResource({
      fields: [{ classifications: ["operational"], id: "id" }],
      kind: "empty-optional-subject-fields",
      label: "Empty optional subject fields",
      scope: "global",
      subject: {
        idField: "id",
        labelField: "",
        tenantField: "",
        type: "user",
      },
    });

    expect(validateDataGovernanceResources([resource])).toEqual({ diagnostics: [], valid: true });

    const artifact = createDataMapArtifact([resource]);

    expect(artifact.resources[0]?.subject).toEqual(resource.subject);
    expect(createHash("sha256").update(stringifyDataMapArtifact(artifact)).digest("hex")).toBe(
      "f6348744e38565340edde9726b0b237757fb4166af0a376d38bd61dcf52b36d2",
    );
  });

  it("preserves base artifact bytes for validator-valid empty optional resource and field strings", () => {
    const resource = defineDataGovernanceResource({
      description: "",
      fields: [
        {
          classifications: ["operational"],
          description: "",
          id: "id",
          label: "",
          source: "",
          valueType: "",
        },
      ],
      kind: "empty-optional-artifact-fields",
      label: "Empty optional artifact fields",
      scope: "global",
      subject: {
        idField: "id",
        type: "user",
      },
    });

    expect(validateDataGovernanceResources([resource])).toEqual({ diagnostics: [], valid: true });
    const artifact = createDataMapArtifact([resource]);

    expect(artifact.resources[0]).not.toHaveProperty("description");
    expect(artifact.resources[0]?.fields[0]).not.toHaveProperty("description");
    expect(artifact.resources[0]?.fields[0]).not.toHaveProperty("label");
    expect(artifact.resources[0]?.fields[0]).not.toHaveProperty("source");
    expect(artifact.resources[0]?.fields[0]).not.toHaveProperty("valueType");
    expect(createHash("sha256").update(stringifyDataMapArtifact(artifact)).digest("hex")).toBe(
      "e52211edcfdb3318de089b246b1487cfbbf07bbe8be898da8785ab90d1aeb209",
    );
  });

  it("projects subject and retention artifacts onto their supported schema fields", () => {
    const resource = {
      fields: [{ classifications: ["operational"], id: "id" }],
      kind: "projected-schema",
      label: "Projected schema",
      retentionPolicies: [
        {
          basis: "",
          disposition: "delete",
          durationDays: 30,
          id: "projected-retention",
          startsFrom: "",
          unexpected: "remove",
        },
      ],
      scope: "global",
      subject: {
        idField: "id",
        labelField: "",
        tenantField: "",
        type: "user",
        unexpected: "remove",
      },
    } as unknown as DataGovernanceResource;

    expect(validateDataGovernanceResources([resource])).toEqual({ diagnostics: [], valid: true });

    const artifact = createDataMapArtifact([resource]);

    expect(artifact.resources[0]?.subject).toEqual({
      idField: "id",
      labelField: "",
      tenantField: "",
      type: "user",
    });
    expect(artifact.resources[0]?.retentionPolicies).toEqual([
      {
        basis: "",
        disposition: "delete",
        durationDays: 30,
        id: "projected-retention",
        startsFrom: "",
      },
    ]);
  });

  it("fails closed when projecting invalid numeric governance values", () => {
    const resource = {
      ...userResource,
      problems: [
        {
          category: "InternalServerError",
          code: "governance-core/non-finite-status",
          status: Number.POSITIVE_INFINITY,
          title: "Non-finite status",
        },
      ],
      retentionPolicies: [
        {
          ...userResource.retentionPolicies[0],
          durationDays: -1,
        },
      ],
    } as unknown as DataGovernanceResource;

    const artifact = createDataMapArtifact([resource]);

    expect(artifact.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.retentionPolicyDurationInvalid,
          path: "resources[0].retentionPolicies[0].durationDays",
        }),
        expect.objectContaining({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.valueInvalid,
          path: "resources[0].problems[0].status",
        }),
      ]),
    );
    expect(artifact.resources[0]?.retentionPolicies[0]?.durationDays).toBe(0);
    expect(
      artifact.resources[0]?.problems.find(
        (problem) => problem.code === "governance-core/non-finite-status",
      ),
    ).toMatchObject({ status: 500 });
    expect(stringifyDataMapArtifact(artifact)).not.toContain('"status": null');
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

    let validationProblem: DataGovernanceValidationProblem | undefined;
    try {
      assertDataGovernanceResourcesValid([invalid]);
    } catch (error) {
      expect(error).toBeInstanceOf(DataGovernanceValidationProblem);
      validationProblem = error as DataGovernanceValidationProblem;
    }

    expect(validationProblem).toBeDefined();
    expect(() => JSON.stringify(validationProblem)).not.toThrow();
    expect(validationProblem?.toJSON()).toMatchObject({
      code: "governance-core/resource-validation-failed",
      diagnostics: report.diagnostics.map((diagnostic) =>
        Object.fromEntries(Object.entries(diagnostic).filter(([, value]) => value !== undefined)),
      ),
    });
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
      reason: "Capability status is invalid",
      status: "not-supported",
    });
    expect(artifact.resources[0]?.capabilities.delete).toMatchObject({
      reason: "Capability status is not declared",
      status: "not-supported",
    });
  });

  it("requires exact capability status discriminants", () => {
    const malformed = {
      ...userResource,
      fields: [
        ...userResource.fields,
        { classifications: ["operational"], id: "tenantId", valueType: "identifier" },
      ],
      subjectRequests: {
        export: {
          audit: {
            actor: false,
            eventName: 1,
            metadata: [],
            subjectType: 2,
          },
          handlerId: "user-export-handler",
          metadata: [],
          status: " supported ",
        },
      },
    } as unknown as DataGovernanceResource;

    const report = validateDataGovernanceResources([malformed]);
    const artifact = createDataMapArtifact([malformed]);

    expect(report.diagnostics).toEqual(
      expect.arrayContaining(
        [
          "resources[0].subjectRequests.export.audit.actor",
          "resources[0].subjectRequests.export.audit.eventName",
          "resources[0].subjectRequests.export.audit.metadata",
          "resources[0].subjectRequests.export.audit.subjectType",
          "resources[0].subjectRequests.export.metadata",
        ].map((path) =>
          expect.objectContaining({
            code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.valueInvalid,
            path,
          }),
        ),
      ),
    );
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({
        code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.capabilityStatusInvalid,
        path: "resources[0].subjectRequests.export.status",
      }),
    );
    expect(artifact.resources[0]?.capabilities.export).toMatchObject({
      reason: "Capability status is invalid",
      status: "not-supported",
    });
  });

  it("returns deterministic diagnostics and an artifact when required resource structures are missing", () => {
    const malformed = {
      kind: "malformed-resource",
      label: "Malformed resource",
      scope: "tenant",
    } as unknown as DataGovernanceResource;

    const report = validateDataGovernanceResources([malformed]);

    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.arrayShapeInvalid,
          path: "resources[0].fields",
        }),
        expect.objectContaining({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.fieldRequired,
          path: "resources[0].fields",
        }),
        expect.objectContaining({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.objectShapeInvalid,
          path: "resources[0].subject",
        }),
        expect.objectContaining({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectIdFieldRequired,
          path: "resources[0].subject.idField",
        }),
        expect.objectContaining({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.subjectTypeRequired,
          path: "resources[0].subject.type",
        }),
      ]),
    );
    expect(() => assertDataGovernanceResourcesValid([malformed])).toThrow(
      DataGovernanceValidationProblem,
    );

    const artifact = createDataMapArtifact([malformed]);

    expect(artifact.resources[0]).toMatchObject({
      fields: [],
      subject: { idField: "", type: "" },
    });
    expect(artifact.summary).toMatchObject({ diagnostics: report.diagnostics.length, fields: 0 });
    expect(artifact.projectMapSection.resources[0]).toMatchObject({
      kind: "malformed-resource",
      subjectType: "",
    });
  });

  it.each([
    {
      code: "objectShapeInvalid" as const,
      name: "null resource",
      path: "resources[0]",
      resource: null,
    },
    {
      code: "objectShapeInvalid" as const,
      name: "null field",
      path: "resources[0].fields[0]",
      resource: {
        fields: [null],
        kind: "malformed-resource",
        label: "Malformed resource",
        scope: "tenant",
        subject: { idField: "id", type: "user" },
      },
    },
    {
      code: "objectShapeInvalid" as const,
      name: "null retention policy",
      path: "resources[0].retentionPolicies[0]",
      resource: {
        fields: [],
        kind: "malformed-resource",
        label: "Malformed resource",
        retentionPolicies: [null],
        scope: "tenant",
        subject: { idField: "id", type: "user" },
      },
    },
    {
      code: "objectShapeInvalid" as const,
      name: "null capability",
      path: "resources[0].subjectRequests.export",
      resource: {
        fields: [],
        kind: "malformed-resource",
        label: "Malformed resource",
        scope: "tenant",
        subject: { idField: "id", type: "user" },
        subjectRequests: { export: null },
      },
    },
    {
      code: "arrayShapeInvalid" as const,
      name: "non-array resource Problems",
      path: "resources[0].problems",
      resource: {
        fields: [],
        kind: "malformed-resource",
        label: "Malformed resource",
        problems: {},
        scope: "tenant",
        subject: { idField: "id", type: "user" },
      },
    },
    {
      code: "objectShapeInvalid" as const,
      name: "null capability Problem",
      path: "resources[0].subjectRequests.export.problems[0]",
      resource: {
        fields: [],
        kind: "malformed-resource",
        label: "Malformed resource",
        scope: "tenant",
        subject: { idField: "id", type: "user" },
        subjectRequests: {
          export: {
            problems: [null],
            reason: "Export is unavailable",
            status: "not-supported",
          },
        },
      },
    },
  ])("reports $name without throwing an incidental TypeError", ({ code, path, resource }) => {
    const malformed = resource as unknown as DataGovernanceResource;

    const report = validateDataGovernanceResources([malformed]);

    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({
        code: DATA_GOVERNANCE_DIAGNOSTIC_CODES[code],
        path,
      }),
    );
    expect(() => createDataMapArtifact([malformed])).not.toThrow();
  });

  it("visits sparse resources and preserves malformed array entry indexes", () => {
    const resources: unknown[] = [];
    resources.length = 2;
    resources[1] = {
      fields: [null, { classifications: [], id: "" }],
      kind: "malformed-resource",
      label: "Malformed resource",
      scope: "tenant",
      subject: { idField: "id", type: "user" },
    };

    const report = validateDataGovernanceResources(
      resources as unknown as readonly DataGovernanceResource[],
    );

    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.objectShapeInvalid,
          path: "resources[0]",
        }),
        expect.objectContaining({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.objectShapeInvalid,
          path: "resources[1].fields[0]",
        }),
        expect.objectContaining({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.fieldIdRequired,
          path: "resources[1].fields[1].id",
        }),
      ]),
    );
    expect(() =>
      createDataMapArtifact(resources as unknown as readonly DataGovernanceResource[]),
    ).not.toThrow();
  });

  it("does not coerce hostile classification values while producing diagnostics", () => {
    const nullPrototypeClassification: unknown = Object.create(null);
    const malformed = {
      fields: [
        {
          classifications: [Symbol("pii"), nullPrototypeClassification],
          id: "id",
        },
      ],
      kind: "hostile-classifications",
      label: "Hostile classifications",
      scope: "tenant",
      subject: { idField: "id", type: "user" },
    } as unknown as DataGovernanceResource;

    const report = validateDataGovernanceResources([malformed]);

    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.fieldClassificationUnknown,
          path: "resources[0].fields[0].classifications[0]",
        }),
        expect.objectContaining({
          code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.fieldClassificationUnknown,
          path: "resources[0].fields[0].classifications[1]",
        }),
      ]),
    );
    expect(() => createDataMapArtifact([malformed])).not.toThrow();
  });

  it("diagnoses malformed leaf values and fails closed for supported capabilities", () => {
    const malformed = {
      ...userResource,
      fields: [
        { ...userResource.fields[0], exported: "false" },
        ...userResource.fields.slice(1),
        { classifications: ["operational"], id: "tenantId", valueType: "identifier" },
      ],
      subjectRequests: {
        export: {
          audit: userResource.subjectRequests?.export?.audit,
          handlerId: "user-export-handler",
          problems: [
            {
              category: false,
              code: "governance-core/malformed-problem",
              detail: {},
              metadata: [],
              retryable: "false",
              status: "409",
              title: [],
            },
          ],
          status: "supported",
        },
      },
    } as unknown as DataGovernanceResource;

    const report = validateDataGovernanceResources([malformed]);
    const artifact = createDataMapArtifact([malformed]);

    expect(report.diagnostics).toEqual(
      expect.arrayContaining(
        [
          "resources[0].fields[0].exported",
          "resources[0].subjectRequests.export.problems[0].category",
          "resources[0].subjectRequests.export.problems[0].detail",
          "resources[0].subjectRequests.export.problems[0].metadata",
          "resources[0].subjectRequests.export.problems[0].retryable",
          "resources[0].subjectRequests.export.problems[0].status",
          "resources[0].subjectRequests.export.problems[0].title",
        ].map((path) =>
          expect.objectContaining({
            code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.valueInvalid,
            path,
          }),
        ),
      ),
    );
    expect(artifact.resources[0]?.fields.find((field) => field.id === "id")?.exported).toBe(false);
    expect(artifact.resources[0]?.capabilities.export.status).toBe("not-supported");
    expect(artifact.summary.exportSupported).toBe(0);
  });

  it.each([
    {
      capability: {
        audit: {
          actor: "required",
          eventName: "governance.user.export",
          subjectType: "user",
        },
        handlerId: "",
        status: "supported",
      },
      code: "capabilityHandlerRequired" as const,
      path: "resources[0].subjectRequests.export.handlerId",
    },
    {
      capability: {
        handlerId: "user-export-handler",
        status: "supported",
      },
      code: "capabilityAuditRequired" as const,
      path: "resources[0].subjectRequests.export.audit",
    },
    {
      capability: {
        audit: {
          actor: "required",
          eventName: "governance.user.export",
          subjectType: "user",
        },
        handlerId: "user-export-handler",
        problems: [null],
        status: "supported",
      },
      code: "objectShapeInvalid" as const,
      path: "resources[0].subjectRequests.export.problems[0]",
    },
    {
      capability: {
        audit: {
          actor: "invalid",
          eventName: "governance.user.export",
          subjectType: "user",
        },
        handlerId: "user-export-handler",
        status: "supported",
      },
      code: "capabilityAuditRequired" as const,
      path: "resources[0].subjectRequests.export.audit",
    },
  ])(
    "does not advertise structurally invalid supported capabilities ($code)",
    ({ capability, code, path }) => {
      const malformed = {
        ...userResource,
        fields: [
          ...userResource.fields,
          { classifications: ["operational"], id: "tenantId", valueType: "identifier" },
        ],
        subjectRequests: { export: capability },
      } as unknown as DataGovernanceResource;

      const report = validateDataGovernanceResources([malformed]);
      const artifact = createDataMapArtifact([malformed]);

      expect(report.diagnostics).toContainEqual(
        expect.objectContaining({ code: DATA_GOVERNANCE_DIAGNOSTIC_CODES[code], path }),
      );
      expect(artifact.resources[0]?.capabilities.export.status).toBe("not-supported");
      expect(artifact.projectMapSection.resources[0]?.export).toBe("not-supported");
      expect(artifact.summary.exportSupported).toBe(0);
    },
  );

  it("summarizes invalid audit declarations without misidentifying valid required fields", () => {
    const exportCapability = userResource.subjectRequests?.export;
    const malformed = {
      ...userResource,
      fields: [
        ...userResource.fields,
        { classifications: ["operational"], id: "tenantId", valueType: "identifier" },
      ],
      subjectRequests: {
        export: {
          ...exportCapability,
          audit: {
            ...exportCapability?.audit,
            reason: "sometimes",
          },
        },
      },
    } as unknown as DataGovernanceResource;

    const report = validateDataGovernanceResources([malformed]);

    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({
        code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.valueInvalid,
        path: "resources[0].subjectRequests.export.audit.reason",
      }),
    );
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({
        code: DATA_GOVERNANCE_DIAGNOSTIC_CODES.capabilityAuditRequired,
        message: "Data governance export capability audit declaration is invalid",
        path: "resources[0].subjectRequests.export.audit",
      }),
    );
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
