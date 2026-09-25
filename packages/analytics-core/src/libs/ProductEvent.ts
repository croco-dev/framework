import { Problem, ProblemCategory } from "@croco/problems-core";

export type ProductEventScalarSchema =
  | {
      readonly type: "string";
      readonly description?: string;
      readonly enum?: readonly string[];
      readonly optional?: boolean;
    }
  | { readonly type: "number"; readonly description?: string; readonly optional?: boolean }
  | { readonly type: "boolean"; readonly description?: string; readonly optional?: boolean };

export type ProductEventPropertySchema =
  | ProductEventScalarSchema
  | {
      readonly type: "array";
      readonly items: ProductEventScalarSchema;
      readonly description?: string;
      readonly optional?: boolean;
    };

export type ProductEventObjectSchema = {
  readonly type: "object";
  readonly properties: Readonly<Record<string, ProductEventPropertySchema>>;
};

type PropertyValue<S extends ProductEventPropertySchema> = S extends {
  readonly type: "string";
  readonly enum: readonly (infer E)[];
}
  ? E
  : S extends { readonly type: "string" }
    ? string
    : S extends { readonly type: "number" }
      ? number
      : S extends { readonly type: "boolean" }
        ? boolean
        : S extends {
              readonly type: "array";
              readonly items: infer I extends ProductEventScalarSchema;
            }
          ? PropertyValue<I>[]
          : never;

export type ProductEventPayload<S extends ProductEventObjectSchema> = {
  [K in keyof S["properties"] as S["properties"][K] extends { readonly optional: true }
    ? never
    : K]: PropertyValue<S["properties"][K]>;
} & {
  [K in keyof S["properties"] as S["properties"][K] extends { readonly optional: true }
    ? K
    : never]?: PropertyValue<S["properties"][K]>;
};

export type ProductEventSubjectKind = "user" | "tenant" | "anonymous";
export type ProductEventOccurrence = "intent" | "committed" | "client-observed";
export type ProductEventScope = "app" | "tenant";

export type ProductEventDefinition<S extends ProductEventObjectSchema = ProductEventObjectSchema> =
  {
    readonly name: string;
    readonly description: string;
    readonly version: number;
    readonly schema: S;
    readonly subjectKind: ProductEventSubjectKind;
    readonly occurrence: ProductEventOccurrence;
    readonly scope: ProductEventScope;
    readonly owner: string;
    readonly sourceLocation: string;
    readonly properties: Readonly<Record<keyof S["properties"] & string, string>>;
  };

export type EventDescriptor = {
  readonly name: string;
  readonly description: string;
  readonly version: number;
  readonly subjectKind: ProductEventSubjectKind;
  readonly occurrence: ProductEventOccurrence;
  readonly scope: ProductEventScope;
  readonly schema: Readonly<Record<string, unknown>>;
  readonly propertyDescriptions: Readonly<Record<string, string>>;
  readonly sourceLocation: string;
  readonly owner: string;
};

export type ProductEventSubject = {
  readonly kind: ProductEventSubjectKind;
  readonly id: string;
};

export type ProductEventContext = {
  readonly appId: string;
  readonly environment: string;
  readonly tenantId?: string;
  readonly subject: ProductEventSubject;
  readonly eventId: string;
  readonly occurredAt: string;
};

export type ProductEventEnvelope = ProductEventContext & {
  readonly name: string;
  readonly schemaVersion: number;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly receivedAt: string;
};

export type ProductEventValidationResult =
  | { readonly status: "valid" }
  | { readonly status: "invalid"; readonly code: string };

export type CaptureResult = (
  | { readonly status: "accepted"; readonly eventId: string; readonly receivedAt: string }
  | { readonly status: "invalid"; readonly code: string }
  | { readonly status: "unavailable"; readonly code: string }
) & { readonly diagnosticsUnavailable?: true };

export type EventObservation =
  | { readonly kind: "unobserved" }
  | {
      readonly kind: "observed";
      readonly receivedCount: number;
      readonly lastReceivedAt?: string;
      readonly recentFailureCodes: readonly string[];
    };

export type ProductEventDiagnosticScope = {
  readonly appId: string;
  readonly environment: string;
  readonly tenantId?: string;
};

export interface ProductEventDiagnosticsSink {
  recordAccepted(
    scope: ProductEventDiagnosticScope,
    name: string,
    version: number,
    receivedAt: string,
  ): void;
  recordFailure(
    scope: ProductEventDiagnosticScope,
    name: string,
    version: number,
    code: string,
  ): void;
  getObservation(
    scope: ProductEventDiagnosticScope,
    name: string,
    version: number,
  ): EventObservation;
}

export class ProductEventDefinitionProblem extends Problem {
  readonly code = "analytics-core/product-event-definition-invalid";
  readonly category = ProblemCategory.ValidationError;

  constructor(reason: string) {
    super(undefined, undefined, reason);
  }
}

const RESERVED_PROPERTIES = new Set([
  "appId",
  "environment",
  "tenantId",
  "userId",
  "eventId",
  "occurredAt",
  "receivedAt",
  "schemaVersion",
  "subject",
  "subjectKind",
  "groups",
  "distinctId",
  "$insert_id",
]);

export function defineProductEvent<const S extends ProductEventObjectSchema>(
  definition: ProductEventDefinition<S>,
): ProductEventDefinition<S> {
  if (
    !isRecord(definition) ||
    typeof definition.name !== "string" ||
    !definition.name.trim() ||
    typeof definition.description !== "string" ||
    !definition.description.trim() ||
    !Number.isSafeInteger(definition.version) ||
    definition.version < 1 ||
    typeof definition.owner !== "string" ||
    !definition.owner.trim() ||
    typeof definition.sourceLocation !== "string" ||
    !definition.sourceLocation.trim() ||
    !["user", "tenant", "anonymous"].includes(definition.subjectKind) ||
    !["intent", "committed", "client-observed"].includes(definition.occurrence) ||
    !["app", "tenant"].includes(definition.scope)
  ) {
    throw new ProductEventDefinitionProblem(
      "Product event name, description, positive version, owner, and source location are required",
    );
  }
  if (
    definition.schema?.type !== "object" ||
    !isRecord(definition.schema.properties) ||
    !isRecord(definition.properties)
  ) {
    throw new ProductEventDefinitionProblem(
      "Product event schema and property descriptions are required",
    );
  }
  const schemaKeys = Object.keys(definition.schema.properties);
  if (
    schemaKeys.length === 0 ||
    schemaKeys.some((key) => RESERVED_PROPERTIES.has(key) || key.startsWith("$"))
  ) {
    throw new ProductEventDefinitionProblem(
      "Product event properties must be non-empty and cannot use reserved context names",
    );
  }
  for (const property of Object.values(definition.schema.properties)) {
    if (!isValidPropertySchema(property)) {
      throw new ProductEventDefinitionProblem("Product event property schema is unsupported");
    }
  }
  if (
    schemaKeys.some(
      (key) => typeof definition.properties[key] !== "string" || !definition.properties[key].trim(),
    ) ||
    Object.keys(definition.properties).some(
      (key) => !Object.prototype.hasOwnProperty.call(definition.schema.properties, key),
    )
  ) {
    throw new ProductEventDefinitionProblem("Each schema property requires one description");
  }
  for (const property of Object.values(definition.schema.properties)) {
    freezePropertySchema(property);
  }
  Object.freeze(definition.schema.properties);
  Object.freeze(definition.schema);
  Object.freeze(definition.properties);
  return Object.freeze(definition);
}

type MutableObservation = {
  receivedCount: number;
  lastReceivedAt?: string;
  recentFailureCodes: string[];
};

/** Process-local diagnostics only; use an injected durable sink when retention is required. */
export class InMemoryProductEventDiagnosticsSink implements ProductEventDiagnosticsSink {
  private readonly observations = new Map<string, MutableObservation>();

  constructor(
    private readonly maxEntries = 100,
    private readonly maxFailureCodes = 10,
  ) {
    if (
      !Number.isSafeInteger(maxEntries) ||
      maxEntries < 1 ||
      !Number.isSafeInteger(maxFailureCodes) ||
      maxFailureCodes < 1
    ) {
      throw new ProductEventDefinitionProblem("Diagnostic sink bounds must be positive integers");
    }
  }

  recordAccepted(
    scope: ProductEventDiagnosticScope,
    name: string,
    version: number,
    receivedAt: string,
  ): void {
    const observation = this.ensure(scope, name, version);
    observation.receivedCount += 1;
    observation.lastReceivedAt = receivedAt;
  }

  recordFailure(
    scope: ProductEventDiagnosticScope,
    name: string,
    version: number,
    code: string,
  ): void {
    const observation = this.ensure(scope, name, version);
    observation.recentFailureCodes.push(code);
    if (observation.recentFailureCodes.length > this.maxFailureCodes)
      observation.recentFailureCodes.shift();
  }

  getObservation(
    scope: ProductEventDiagnosticScope,
    name: string,
    version: number,
  ): EventObservation {
    const observation = this.observations.get(observationKey(scope, name, version));
    if (!observation) return { kind: "unobserved" };
    return {
      kind: "observed",
      receivedCount: observation.receivedCount,
      ...(observation.lastReceivedAt ? { lastReceivedAt: observation.lastReceivedAt } : {}),
      recentFailureCodes: [...observation.recentFailureCodes],
    };
  }

  private ensure(
    scope: ProductEventDiagnosticScope,
    name: string,
    version: number,
  ): MutableObservation {
    const key = observationKey(scope, name, version);
    let observation = this.observations.get(key);
    if (!observation) {
      if (this.observations.size >= this.maxEntries) {
        const oldest = this.observations.keys().next().value;
        if (oldest !== undefined) this.observations.delete(oldest);
      }
      observation = { receivedCount: 0, recentFailureCodes: [] };
      this.observations.set(key, observation);
    }
    return observation;
  }
}

export class ProductEventCatalog {
  private readonly definitions = new Map<string, ProductEventDefinition>();

  constructor(
    definitions: readonly ProductEventDefinition[],
    private readonly manager?: {
      captureValidatedEnvelope(envelope: ProductEventEnvelope): boolean;
    },
    private readonly diagnostics: ProductEventDiagnosticsSink = new InMemoryProductEventDiagnosticsSink(),
  ) {
    for (const definition of definitions) {
      defineProductEvent(definition);
      const key = eventKey(definition.name, definition.version);
      if (this.definitions.has(key)) {
        throw new ProductEventDefinitionProblem(
          `Product event ${key} is registered more than once`,
        );
      }
      this.definitions.set(key, definition);
    }
  }

  listDescriptors(): readonly EventDescriptor[] {
    return [...this.definitions.values()]
      .map(toEventDescriptor)
      .sort((a, b) => compareBytes(a.name, b.name) || a.version - b.version);
  }

  getDescriptor(name: string, version: number): EventDescriptor | undefined {
    const definition = this.definitions.get(eventKey(name, version));
    return definition ? toEventDescriptor(definition) : undefined;
  }

  getObservation(
    scope: ProductEventDiagnosticScope,
    name: string,
    version: number,
  ): EventObservation {
    return this.diagnostics.getObservation(scope, name, version);
  }

  validatePayload(name: string, version: number, payload: unknown): ProductEventValidationResult {
    const definition = this.definitions.get(eventKey(name, version));
    if (!definition)
      return { status: "invalid", code: "analytics-core/product-event-version-unregistered" };
    if (!isRecord(payload))
      return { status: "invalid", code: "analytics-core/product-event-payload-invalid" };
    const schema = definition.schema.properties;
    for (const key of Reflect.ownKeys(payload)) {
      if (typeof key !== "string") {
        return { status: "invalid", code: "analytics-core/product-event-property-unknown" };
      }
      const own = Object.getOwnPropertyDescriptor(payload, key);
      if (
        !own ||
        !own.enumerable ||
        !("value" in own) ||
        RESERVED_PROPERTIES.has(key) ||
        !Object.prototype.hasOwnProperty.call(schema, key)
      ) {
        return { status: "invalid", code: "analytics-core/product-event-property-unknown" };
      }
    }
    for (const [key, property] of Object.entries(schema)) {
      const own = Object.getOwnPropertyDescriptor(payload, key);
      if (!own) {
        if (!property.optional)
          return { status: "invalid", code: "analytics-core/product-event-property-required" };
      } else if (own.value === undefined && property.optional) {
        continue;
      } else if (!matchesProperty(own.value, property)) {
        return { status: "invalid", code: "analytics-core/product-event-property-invalid" };
      }
    }
    return { status: "valid" };
  }

  captureTyped<S extends ProductEventObjectSchema>(
    definition: ProductEventDefinition<S>,
    payload: ProductEventPayload<S>,
    context: ProductEventContext,
  ): CaptureResult {
    const registered = this.definitions.get(eventKey(definition.name, definition.version));
    if (!registered)
      return { status: "invalid", code: "analytics-core/product-event-version-unregistered" };
    if (registered !== definition)
      return { status: "invalid", code: "analytics-core/product-event-definition-unregistered" };
    if (!isValidContext(registered, context)) {
      return { status: "invalid", code: "analytics-core/product-event-context-invalid" };
    }
    const scope = diagnosticScope(context);
    const validation = this.validatePayload(definition.name, definition.version, payload);
    if (validation.status === "invalid") {
      return {
        ...validation,
        ...tryRecordDiagnostic(() =>
          this.diagnostics.recordFailure(
            scope,
            definition.name,
            definition.version,
            validation.code,
          ),
        ),
      };
    }
    const validatedPayload = Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [
        key,
        Array.isArray(value) ? [...value] : value,
      ]),
    );
    const transportUnavailable = (): CaptureResult => {
      const code = "analytics-core/product-event-transport-unavailable";
      return {
        status: "unavailable",
        code,
        ...tryRecordDiagnostic(() =>
          this.diagnostics.recordFailure(scope, definition.name, definition.version, code),
        ),
      };
    };
    if (!this.manager) return transportUnavailable();
    const receivedAt = new Date().toISOString();
    const envelope: ProductEventEnvelope = {
      ...context,
      name: definition.name,
      schemaVersion: definition.version,
      payload: validatedPayload,
      receivedAt,
    };
    let accepted: boolean;
    try {
      accepted = this.manager.captureValidatedEnvelope(envelope);
    } catch {
      return transportUnavailable();
    }
    if (!accepted) return transportUnavailable();
    return {
      status: "accepted",
      eventId: context.eventId,
      receivedAt,
      ...tryRecordDiagnostic(() =>
        this.diagnostics.recordAccepted(scope, definition.name, definition.version, receivedAt),
      ),
    };
  }
}

export function productEventManifestJson(catalog: ProductEventCatalog): string {
  return `${JSON.stringify(catalog.listDescriptors(), null, 2)}\n`;
}

export function productEventManifestMarkdown(catalog: ProductEventCatalog): string {
  const lines = ["# Product events", ""];
  for (const descriptor of catalog.listDescriptors()) {
    lines.push(`## ${descriptor.name} v${descriptor.version}`, "");
    lines.push(descriptor.description, "");
    lines.push(`- Owner: ${descriptor.owner}`);
    lines.push(`- Subject: ${descriptor.subjectKind}`);
    lines.push(`- Scope: ${descriptor.scope}`);
    lines.push(`- Occurrence: ${descriptor.occurrence}`);
    lines.push(`- Source: ${descriptor.sourceLocation}`);
    lines.push("", "### Properties", "");
    for (const [name, description] of Object.entries(descriptor.propertyDescriptions)) {
      lines.push(`- \`${name}\`: ${description}`);
    }
    lines.push("", "```json");
    lines.push(JSON.stringify(descriptor.schema, null, 2), "```", "");
  }
  return `${lines.join("\n")}\n`;
}

function eventKey(name: string, version: number): string {
  return `${name}@${version}`;
}

function observationKey(scope: ProductEventDiagnosticScope, name: string, version: number): string {
  return JSON.stringify([scope.appId, scope.environment, scope.tenantId ?? null, name, version]);
}

function diagnosticScope(context: ProductEventContext): ProductEventDiagnosticScope {
  return {
    appId: context.appId,
    environment: context.environment,
    ...(context.tenantId ? { tenantId: context.tenantId } : {}),
  };
}

function tryRecordDiagnostic(record: () => void): { readonly diagnosticsUnavailable?: true } {
  try {
    record();
    return {};
  } catch {
    return { diagnosticsUnavailable: true };
  }
}

function compareBytes(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function matchesProperty(value: unknown, property: ProductEventPropertySchema): boolean {
  switch (property.type) {
    case "string":
      return typeof value === "string" && (!property.enum || property.enum.includes(value));
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "array": {
      if (
        !Array.isArray(value) ||
        Object.getPrototypeOf(value) !== Array.prototype ||
        Reflect.ownKeys(value).length !== value.length + 1
      )
        return false;
      for (let index = 0; index < value.length; index++) {
        const own = Object.getOwnPropertyDescriptor(value, String(index));
        if (!own?.enumerable || !("value" in own) || !matchesProperty(own.value, property.items))
          return false;
      }
      return true;
    }
  }
}

function isValidPropertySchema(property: unknown): property is ProductEventPropertySchema {
  if (!isRecord(property)) return false;
  if (property.optional !== undefined && typeof property.optional !== "boolean") return false;
  switch (property.type) {
    case "string":
      return (
        property.enum === undefined ||
        (Array.isArray(property.enum) &&
          property.enum.length > 0 &&
          property.enum.every((value) => typeof value === "string"))
      );
    case "number":
    case "boolean":
      return true;
    case "array":
      return (
        isRecord(property.items) &&
        property.items.type !== "array" &&
        isValidPropertySchema(property.items)
      );
    default:
      return false;
  }
}

function freezePropertySchema(property: ProductEventPropertySchema): void {
  if (property.type === "array") freezePropertySchema(property.items);
  if (property.type === "string" && property.enum) Object.freeze(property.enum);
  Object.freeze(property);
}

function isValidContext(definition: ProductEventDefinition, context: ProductEventContext): boolean {
  if (
    !isRecord(context) ||
    typeof context.appId !== "string" ||
    typeof context.environment !== "string" ||
    typeof context.eventId !== "string" ||
    typeof context.occurredAt !== "string" ||
    !isRecord(context.subject) ||
    typeof context.subject.id !== "string" ||
    typeof context.subject.kind !== "string" ||
    (context.tenantId !== undefined && typeof context.tenantId !== "string")
  ) {
    return false;
  }
  return Boolean(
    context.appId.trim() &&
    context.environment.trim() &&
    context.eventId.trim() &&
    context.subject.id.trim() &&
    context.subject.kind === definition.subjectKind &&
    (definition.scope === "app" ? context.tenantId === undefined : context.tenantId?.trim()) &&
    (context.subject.kind !== "tenant" || context.subject.id === context.tenantId) &&
    !Number.isNaN(Date.parse(context.occurredAt)),
  );
}

function toEventDescriptor(definition: ProductEventDefinition): EventDescriptor {
  const properties = Object.fromEntries(
    Object.entries(definition.schema.properties)
      .sort(([a], [b]) => compareBytes(a, b))
      .map(([name, schema]) => [name, toJsonSchema(schema)]),
  );
  const required = Object.entries(definition.schema.properties)
    .filter(([, schema]) => !schema.optional)
    .map(([name]) => name)
    .sort();
  return {
    name: definition.name,
    description: definition.description,
    version: definition.version,
    subjectKind: definition.subjectKind,
    occurrence: definition.occurrence,
    scope: definition.scope,
    schema: { type: "object", properties, required, additionalProperties: false },
    propertyDescriptions: Object.fromEntries(
      Object.entries(definition.properties).sort(([a], [b]) => compareBytes(a, b)),
    ),
    sourceLocation: definition.sourceLocation,
    owner: definition.owner,
  };
}

function toJsonSchema(schema: ProductEventPropertySchema): Readonly<Record<string, unknown>> {
  switch (schema.type) {
    case "string":
      return { type: "string", ...(schema.enum ? { enum: schema.enum } : {}) };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "array":
      return { type: "array", items: toJsonSchema(schema.items) };
  }
}
