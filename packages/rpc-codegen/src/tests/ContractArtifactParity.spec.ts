import * as fs from "node:fs";
import * as path from "node:path";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { emitOpenAPIFromContractGraph } from "@croco/openapi-spec";
import { Problem, ProblemCategory } from "@croco/problems-core";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { generateClientFilesFromContractGraph } from "../libs/generate";

import type { ContractGraph } from "@croco/protocols-core";

extendZodWithOpenApi(z);

const TEMP_DIR = path.join(__dirname, "contract-artifact-parity-temp");
const OPENAPI_ARTIFACT_PATH = path.join(TEMP_DIR, "openapi.json");

type SchemaLocation = "path" | "query" | "headers" | "body" | "response";

type ProblemSnapshot = {
  readonly code: string;
  readonly category: string;
  readonly status: number;
  readonly description?: string;
  readonly type?: string;
  readonly cookbookPath?: string;
};

type OperationSnapshot = {
  readonly artifactPath: string;
  readonly routeId: string;
  readonly method: string;
  readonly path: string;
  readonly operationId: string;
  readonly schemas: Partial<Record<SchemaLocation, string>>;
  readonly problems: readonly ProblemSnapshot[];
};

type ComparableOperationSnapshot = Omit<OperationSnapshot, "artifactPath">;

type ObjectFieldFingerprint = {
  readonly name: string;
  readonly fingerprint: string;
  readonly optional?: boolean;
};

type RpcRouteMetadata = {
  readonly routeId: string;
  readonly operationId: string;
  readonly methodName: string;
  readonly method: string;
  readonly path: string;
};

class ContractArtifactParityProblem extends Problem {
  constructor(detail: string) {
    super("rpc-codegen/contract-artifact-parity", ProblemCategory.InternalServerError, detail);
  }
}

describe("Contract artifact parity", () => {
  beforeEach(() => {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  });

  it("should compare generated OpenAPI and RPC operation artifacts from one ContractGraph fixture", () => {
    const { openApi, rpc } = createParitySnapshots();

    expect(() => assertOperationParity(openApi, rpc)).not.toThrow();
    expect(toComparableSnapshot(openApi)).toEqual({
      routeId: "WidgetsController.updateWidget",
      method: "PATCH",
      path: "/tenants/:tenantId/widgets/:widgetId",
      operationId: "WidgetsController_updateWidget",
      schemas: {
        path: "object(tenantId:string,widgetId:string)",
        query: "object(view?:enum(detail|summary))",
        headers: "object(x-request-id?:string)",
        body: "object(displayName:string,note?:string,revision:number)",
        response: "object(displayName:string,id:string,status:enum(active|disabled))",
      },
      problems: [
        {
          code: "WIDGET_CONFLICT",
          category: "Conflict",
          status: 409,
          description: "The widget revision is stale.",
          type: "https://example.com/problems/widget-conflict",
          cookbookPath: "/reference/problem-recovery-cookbook/#widget-conflict",
        },
        {
          code: "WIDGET_NOT_FOUND",
          category: "NotFound",
          status: 404,
          description: "The widget does not exist.",
        },
      ],
    });
    expect(toComparableSnapshot(rpc)).toEqual(toComparableSnapshot(openApi));
  });

  it("should report both artifact paths when parity drifts", () => {
    const { openApi, rpc } = createParitySnapshots();
    const driftedRpc: OperationSnapshot = {
      ...rpc,
      schemas: {
        ...rpc.schemas,
        body: "object(displayName:string)",
      },
    };

    expect(() => assertOperationParity(openApi, driftedRpc)).toThrow(
      [
        "Contract artifact parity drift for WidgetsController.updateWidget at schemas.",
        `OpenAPI artifact: ${OPENAPI_ARTIFACT_PATH}#/paths/~1tenants~1{tenantId}~1widgets~1{widgetId}/patch`,
        `RPC artifact: ${path.join(TEMP_DIR, "widgets.ts")}#updateWidget`,
      ].join("\n"),
    );
  });
});

function createParitySnapshots(): {
  readonly openApi: OperationSnapshot;
  readonly rpc: OperationSnapshot;
} {
  const graph = createContractArtifactParityGraph();
  const document = emitOpenAPIFromContractGraph(graph);
  const files = generateClientFilesFromContractGraph(graph, TEMP_DIR);

  fs.writeFileSync(OPENAPI_ARTIFACT_PATH, `${JSON.stringify(document, null, 2)}\n`);

  return {
    openApi: collectOpenAPIOperationSnapshot(
      document,
      OPENAPI_ARTIFACT_PATH,
      "WidgetsController.updateWidget",
    ),
    rpc: collectRpcOperationSnapshot(files, "WidgetsController.updateWidget"),
  };
}

function createContractArtifactParityGraph(): ContractGraph {
  const pathSchema = z.object({
    tenantId: z.string(),
    widgetId: z.string(),
  });
  const querySchema = z.object({
    view: z.enum(["summary", "detail"]).optional(),
  });
  const headerSchema = z.object({
    "x-request-id": z.string().optional(),
  });
  const bodySchema = z.object({
    displayName: z.string(),
    note: z.string().optional(),
    revision: z.number(),
  });
  const responseSchema = z.object({
    id: z.string(),
    displayName: z.string(),
    status: z.enum(["active", "disabled"]),
  });

  return {
    version: "croco.contract-graph.v1",
    controllers: [
      {
        name: "WidgetsController",
        path: "/tenants/:tenantId/widgets",
        guards: [],
        roles: [],
        routeIds: ["WidgetsController.updateWidget"],
      },
    ],
    routes: [
      {
        routeId: "WidgetsController.updateWidget",
        operationId: "WidgetsController_updateWidget",
        controllerName: "WidgetsController",
        methodName: "updateWidget",
        httpMethod: "PATCH",
        path: "/tenants/:tenantId/widgets/:widgetId",
        controllerPath: "/tenants/:tenantId/widgets",
        routeContract: null,
        params: [
          { kind: "path", name: "tenantId", schema: pathSchema.shape.tenantId },
          { kind: "path", name: "widgetId", schema: pathSchema.shape.widgetId },
          { kind: "query", name: "view", schema: querySchema.shape.view },
          { kind: "header", name: "x-request-id", schema: headerSchema.shape["x-request-id"] },
          { kind: "body", name: "", schema: bodySchema },
        ],
        inputSchema: bodySchema,
        inputSchemas: {
          body: bodySchema,
          path: pathSchema,
          query: querySchema,
          headers: headerSchema,
        },
        outputSchema: responseSchema,
        domain: "widgets",
        access: { guards: [], roles: [] },
        entitlements: [],
        problemResponses: [
          {
            code: "WIDGET_CONFLICT",
            category: ProblemCategory.Conflict,
            status: 409,
            description: "The widget revision is stale.",
            type: "https://example.com/problems/widget-conflict",
            cookbookPath: "/reference/problem-recovery-cookbook/#widget-conflict",
          },
          {
            code: "WIDGET_NOT_FOUND",
            category: ProblemCategory.NotFound,
            status: 404,
            description: "The widget does not exist.",
          },
        ],
      },
    ],
    diagnostics: [],
  };
}

function collectOpenAPIOperationSnapshot(
  document: ReturnType<typeof emitOpenAPIFromContractGraph>,
  artifactPath: string,
  routeId: string,
): OperationSnapshot {
  for (const [openApiPath, pathItem] of Object.entries(document.paths ?? {})) {
    if (!isRecord(pathItem)) {
      continue;
    }

    for (const method of ["get", "post", "put", "delete", "patch", "head", "options", "trace"]) {
      const operation = pathItem[method];

      if (!isRecord(operation) || operation.summary !== routeId) {
        continue;
      }

      return {
        artifactPath: `${artifactPath}#/paths/${toJsonPointerSegment(openApiPath)}/${method}`,
        routeId,
        method: method.toUpperCase(),
        path: toContractPath(openApiPath),
        operationId: getString(operation.operationId, "OpenAPI operationId"),
        schemas: collectOpenAPISchemaFingerprints(operation),
        problems: collectOpenAPIProblems(operation),
      };
    }
  }

  throw new ContractArtifactParityProblem(
    `OpenAPI artifact ${artifactPath} is missing route ${routeId}.`,
  );
}

function collectOpenAPISchemaFingerprints(
  operation: Record<string, unknown>,
): OperationSnapshot["schemas"] {
  return withoutUndefinedValues({
    path: collectOpenAPIParameterFingerprint(operation, "path"),
    query: collectOpenAPIParameterFingerprint(operation, "query"),
    headers: collectOpenAPIParameterFingerprint(operation, "header"),
    body: normalizeOpenAPISchema(getOpenAPIContentSchema(operation.requestBody)),
    response: normalizeOpenAPISchema(getOpenAPIResponseSchema(operation)),
  });
}

function collectOpenAPIParameterFingerprint(
  operation: Record<string, unknown>,
  location: "path" | "query" | "header",
): string | undefined {
  const parameters = Array.isArray(operation.parameters) ? operation.parameters : [];
  const fields = parameters
    .filter(isRecord)
    .filter((parameter) => parameter.in === location)
    .map((parameter) => ({
      name: getString(parameter.name, `OpenAPI ${location} parameter name`),
      fingerprint: normalizeOpenAPISchema(parameter.schema) ?? "unknown",
      optional: location !== "path" && parameter.required !== true,
    }));

  return fields.length > 0 ? objectFingerprint(fields) : undefined;
}

function getOpenAPIResponseSchema(operation: Record<string, unknown>): unknown {
  const responses = isRecord(operation.responses) ? operation.responses : {};
  const successResponse = responses["200"];

  return isRecord(successResponse) ? getOpenAPIContentSchema(successResponse) : undefined;
}

function getOpenAPIContentSchema(container: unknown): unknown {
  if (!isRecord(container) || !isRecord(container.content)) {
    return undefined;
  }

  const jsonContent = container.content["application/json"];

  return isRecord(jsonContent) ? jsonContent.schema : undefined;
}

function normalizeOpenAPISchema(schema: unknown): string | undefined {
  if (!schema) {
    return undefined;
  }
  if (!isRecord(schema)) {
    return JSON.stringify(schema);
  }
  if (Array.isArray(schema.enum)) {
    return enumFingerprint(schema.nullable === true ? [...schema.enum, null] : schema.enum);
  }
  if (schema.type === "array") {
    return `array(${normalizeOpenAPISchema(schema.items) ?? "unknown"})`;
  }
  if (schema.type === "object" || isRecord(schema.properties)) {
    const properties = isRecord(schema.properties) ? schema.properties : {};
    const required = new Set(Array.isArray(schema.required) ? schema.required.map(String) : []);
    const fields = Object.entries(properties).map(([name, property]) => ({
      name,
      fingerprint: normalizeOpenAPISchema(property) ?? "unknown",
      optional: !required.has(name),
    }));

    return objectFingerprint(fields);
  }
  if (typeof schema.type === "string") {
    return schema.nullable === true ? unionFingerprint([schema.type, "null"]) : schema.type;
  }
  if (typeof schema.$ref === "string") {
    return `ref(${schema.$ref})`;
  }

  return JSON.stringify(schema);
}

function collectOpenAPIProblems(operation: Record<string, unknown>): readonly ProblemSnapshot[] {
  const responses = isRecord(operation.responses) ? operation.responses : {};
  const problems = Object.values(responses).flatMap((response) => {
    if (!isRecord(response) || !Array.isArray(response["x-croco-problems"])) {
      return [];
    }

    return response["x-croco-problems"].filter(isRecord).map(toProblemSnapshot);
  });

  return problems.sort(compareProblemSnapshots);
}

function collectRpcOperationSnapshot(files: readonly string[], routeId: string): OperationSnapshot {
  for (const file of files) {
    if (path.basename(file) === "rpc.ts" || path.basename(file) === "index.ts") {
      continue;
    }

    const content = fs.readFileSync(file, "utf-8");
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
    const metadata = findRpcRouteMetadata(sourceFile, routeId);

    if (metadata) {
      return {
        artifactPath: `${file}#${metadata.methodName}`,
        routeId,
        method: metadata.method,
        path: metadata.path,
        operationId: metadata.operationId,
        schemas: collectRpcSchemaFingerprints(sourceFile, metadata.methodName),
        problems: collectRpcProblems(sourceFile, metadata.methodName),
      };
    }
  }

  throw new ContractArtifactParityProblem(`RPC artifacts are missing route ${routeId}.`);
}

function findRpcRouteMetadata(
  sourceFile: ts.SourceFile,
  routeId: string,
): RpcRouteMetadata | undefined {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) {
        continue;
      }

      const name = declaration.name.text;
      const initializer = unwrapExpression(declaration.initializer);

      if (
        !name.endsWith("ContractRoutes") ||
        !initializer ||
        !ts.isArrayLiteralExpression(initializer)
      ) {
        continue;
      }

      for (const element of initializer.elements) {
        if (!ts.isObjectLiteralExpression(element)) {
          continue;
        }

        const metadata = toRpcRouteMetadata(element);

        if (metadata.routeId === routeId) {
          return metadata;
        }
      }
    }
  }

  return undefined;
}

function toRpcRouteMetadata(declaration: ts.ObjectLiteralExpression): RpcRouteMetadata {
  const fields = objectLiteralFields(declaration);

  return {
    routeId: getStringLiteralExpressionValue(fields.routeId, "RPC routeId"),
    operationId: getStringLiteralExpressionValue(fields.operationId, "RPC operationId"),
    methodName: getStringLiteralExpressionValue(fields.methodName, "RPC methodName"),
    method: getStringLiteralExpressionValue(fields.method, "RPC method"),
    path: getStringLiteralExpressionValue(fields.path, "RPC path"),
  };
}

function collectRpcSchemaFingerprints(
  sourceFile: ts.SourceFile,
  methodName: string,
): OperationSnapshot["schemas"] {
  const inputType = findTypeAlias(sourceFile, `${toPascalCase(methodName)}Input`);
  const outputType = findTypeAlias(sourceFile, `${toPascalCase(methodName)}Output`);
  const inputFields =
    inputType && ts.isTypeLiteralNode(inputType.type) ? typeLiteralFields(inputType.type) : {};

  return withoutUndefinedValues({
    path: normalizeTypeNode(inputFields.path),
    query: normalizeTypeNode(inputFields.query),
    headers: normalizeTypeNode(inputFields.headers),
    body: normalizeTypeNode(inputFields.body),
    response: normalizeTypeNode(outputType?.type),
  });
}

function findTypeAlias(
  sourceFile: ts.SourceFile,
  name: string,
): ts.TypeAliasDeclaration | undefined {
  return sourceFile.statements.find(
    (statement): statement is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === name,
  );
}

function typeLiteralFields(type: ts.TypeLiteralNode): Record<string, ts.TypeNode> {
  return Object.fromEntries(
    type.members.flatMap((member) => {
      if (!ts.isPropertySignature(member) || !member.type) {
        return [];
      }

      return [[getPropertyName(member.name), member.type]];
    }),
  );
}

function normalizeTypeNode(type: ts.TypeNode | undefined): string | undefined {
  if (!type) {
    return undefined;
  }
  if (ts.isTypeLiteralNode(type)) {
    return objectFingerprint(
      type.members.flatMap((member) => {
        if (!ts.isPropertySignature(member) || !member.type) {
          return [];
        }

        return [
          {
            name: getPropertyName(member.name),
            fingerprint: normalizeTypeNode(stripUndefinedFromUnion(member.type)) ?? "unknown",
            optional: Boolean(member.questionToken) || isUndefinedUnion(member.type),
          },
        ];
      }),
    );
  }
  if (ts.isUnionTypeNode(type)) {
    const values = type.types.filter((entry) => !isUndefinedKeyword(entry));
    const enumValues = values.map(getStringLiteralOrNullValue);

    if (enumValues.every((value): value is string | null => value !== undefined)) {
      return enumFingerprint(enumValues);
    }

    return unionFingerprint(values.map((entry) => normalizeTypeNode(entry) ?? "unknown"));
  }
  if (ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal)) {
    return `literal(${type.literal.text})`;
  }
  if (isNullTypeNode(type)) {
    return "null";
  }
  if (ts.isArrayTypeNode(type)) {
    return `array(${normalizeTypeNode(type.elementType) ?? "unknown"})`;
  }

  switch (type.kind) {
    case ts.SyntaxKind.StringKeyword:
      return "string";
    case ts.SyntaxKind.NumberKeyword:
      return "number";
    case ts.SyntaxKind.BooleanKeyword:
      return "boolean";
    default:
      return type.getText();
  }
}

function stripUndefinedFromUnion(type: ts.TypeNode): ts.TypeNode {
  if (!ts.isUnionTypeNode(type)) {
    return type;
  }

  const values = type.types.filter((entry) => !isUndefinedKeyword(entry));

  return values.length === 1 ? (values[0] ?? type) : type;
}

function isUndefinedUnion(type: ts.TypeNode): boolean {
  return ts.isUnionTypeNode(type) && type.types.some(isUndefinedKeyword);
}

function isUndefinedKeyword(type: ts.TypeNode): boolean {
  return type.kind === ts.SyntaxKind.UndefinedKeyword;
}

function isStringLiteralTypeNode(type: ts.TypeNode): type is ts.LiteralTypeNode & {
  readonly literal: ts.StringLiteral;
} {
  return ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal);
}

function getStringLiteralOrNullValue(type: ts.TypeNode): string | null | undefined {
  if (isStringLiteralTypeNode(type)) {
    return type.literal.text;
  }

  return isNullTypeNode(type) ? null : undefined;
}

function isNullTypeNode(type: ts.TypeNode): boolean {
  return (
    type.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isLiteralTypeNode(type) && type.literal.kind === ts.SyntaxKind.NullKeyword)
  );
}

function collectRpcProblems(
  sourceFile: ts.SourceFile,
  methodName: string,
): readonly ProblemSnapshot[] {
  const declarationName = `${methodName}ProblemDeclarations`;
  const problems = sourceFile.statements.flatMap((statement) => {
    if (!ts.isVariableStatement(statement)) {
      return [];
    }

    return statement.declarationList.declarations.flatMap((declaration) => {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== declarationName) {
        return [];
      }

      const initializer = unwrapExpression(declaration.initializer);

      if (!initializer || !ts.isArrayLiteralExpression(initializer)) {
        return [];
      }

      return initializer.elements
        .filter(ts.isObjectLiteralExpression)
        .map(parseRpcProblemDeclaration);
    });
  });

  return problems.sort(compareProblemSnapshots);
}

function parseRpcProblemDeclaration(declaration: ts.ObjectLiteralExpression): ProblemSnapshot {
  const fields = objectLiteralFields(declaration);

  return {
    code: getStringLiteralExpressionValue(fields.code, "RPC Problem code"),
    category: getStringLiteralExpressionValue(fields.category, "RPC Problem category"),
    status: getNumberLiteralExpressionValue(fields.status, "RPC Problem status"),
    ...(fields.description
      ? {
          description: getStringLiteralExpressionValue(
            fields.description,
            "RPC Problem description",
          ),
        }
      : {}),
    ...(fields.type
      ? {
          type: getStringLiteralExpressionValue(fields.type, "RPC Problem type"),
        }
      : {}),
    ...(fields.cookbookPath
      ? {
          cookbookPath: getStringLiteralExpressionValue(
            fields.cookbookPath,
            "RPC Problem cookbookPath",
          ),
        }
      : {}),
  };
}

function objectLiteralFields(
  declaration: ts.ObjectLiteralExpression,
): Record<string, ts.Expression> {
  return Object.fromEntries(
    declaration.properties.flatMap((property) => {
      if (!ts.isPropertyAssignment(property)) {
        return [];
      }

      return [[getPropertyName(property.name), property.initializer]];
    }),
  );
}

function unwrapExpression(expression: ts.Expression | undefined): ts.Expression | undefined {
  let current = expression;

  while (
    current &&
    (ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isTypeAssertionExpression(current))
  ) {
    current = current.expression;
  }

  return current;
}

function getStringLiteralExpressionValue(
  expression: ts.Expression | undefined,
  label: string,
): string {
  const value = unwrapExpression(expression);

  if (value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))) {
    return value.text;
  }

  throw new ContractArtifactParityProblem(`${label} must be a string literal.`);
}

function getNumberLiteralExpressionValue(
  expression: ts.Expression | undefined,
  label: string,
): number {
  const value = unwrapExpression(expression);

  if (value && ts.isNumericLiteral(value)) {
    return Number(value.text);
  }

  throw new ContractArtifactParityProblem(`${label} must be a number literal.`);
}

function assertOperationParity(openApi: OperationSnapshot, rpc: OperationSnapshot): void {
  const openApiComparable = toComparableSnapshot(openApi);
  const rpcComparable = toComparableSnapshot(rpc);

  for (const key of Object.keys(openApiComparable) as (keyof ComparableOperationSnapshot)[]) {
    if (JSON.stringify(openApiComparable[key]) !== JSON.stringify(rpcComparable[key])) {
      throw new ContractArtifactParityProblem(
        [
          `Contract artifact parity drift for ${openApi.routeId} at ${key}.`,
          `OpenAPI artifact: ${openApi.artifactPath}`,
          `RPC artifact: ${rpc.artifactPath}`,
          `OpenAPI fingerprint: ${JSON.stringify(openApiComparable[key])}`,
          `RPC fingerprint: ${JSON.stringify(rpcComparable[key])}`,
        ].join("\n"),
      );
    }
  }
}

function toComparableSnapshot(snapshot: OperationSnapshot): ComparableOperationSnapshot {
  const { artifactPath: _artifactPath, ...comparable } = snapshot;

  return comparable;
}

function objectFingerprint(fields: readonly ObjectFieldFingerprint[]): string {
  return `object(${[...fields]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((field) => `${field.name}${field.optional ? "?" : ""}:${field.fingerprint}`)
    .join(",")})`;
}

function enumFingerprint(values: readonly unknown[]): string {
  return `enum(${[...new Set(values.map(String))].sort().join("|")})`;
}

function unionFingerprint(values: readonly string[]): string {
  return `union(${[...new Set(values)].sort().join("|")})`;
}

function withoutUndefinedValues<T extends Record<string, string | undefined>>(
  value: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => entry[1] !== undefined),
  ) as Partial<T>;
}

function toProblemSnapshot(problem: Record<string, unknown>): ProblemSnapshot {
  return {
    code: getString(problem.code, "Problem code"),
    category: getString(problem.category, "Problem category"),
    status: getNumber(problem.status, "Problem status"),
    ...(typeof problem.description === "string" ? { description: problem.description } : {}),
    ...(typeof problem.type === "string" ? { type: problem.type } : {}),
    ...(typeof problem.cookbookPath === "string" ? { cookbookPath: problem.cookbookPath } : {}),
  };
}

function compareProblemSnapshots(left: ProblemSnapshot, right: ProblemSnapshot): number {
  return (
    left.code.localeCompare(right.code) ||
    left.category.localeCompare(right.category) ||
    left.status - right.status
  );
}

function getString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new ContractArtifactParityProblem(`${label} must be a string.`);
  }

  return value;
}

function getNumber(value: unknown, label: string): number {
  if (typeof value !== "number") {
    throw new ContractArtifactParityProblem(`${label} must be a number.`);
  }

  return value;
}

function getPropertyName(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  throw new ContractArtifactParityProblem(`Unsupported generated property name: ${name.getText()}`);
}

function toContractPath(openApiPath: string): string {
  return openApiPath.replace(/\{([^}]+)\}/g, ":$1");
}

function toJsonPointerSegment(value: string): string {
  return value.replace(/~/g, "~0").replace(/\//g, "~1");
}

function toPascalCase(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/)
    .flatMap((part) => part.split(/(?=[A-Z])/))
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
