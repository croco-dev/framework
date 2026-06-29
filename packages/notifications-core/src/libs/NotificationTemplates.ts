import {
  NotificationTemplateAlreadyRegisteredProblem,
  NotificationTemplateNotFoundProblem,
  NotificationTemplateVariablesInvalidProblem,
} from "./problems/NotificationProblems";
import { NotificationChannel } from "./types";

export type NotificationTemplateRef = {
  readonly id: string;
  readonly version: string;
  readonly locale: string;
};

export type NotificationTemplateVariableType = "array" | "boolean" | "number" | "object" | "string";

export type NotificationTemplateVariableEscaping = "html" | "none";

export type NotificationTemplateVariableDefinition = {
  readonly type: NotificationTemplateVariableType;
  readonly required?: boolean;
};

export type NotificationTemplateVariablesSchema = {
  readonly properties: Record<string, NotificationTemplateVariableDefinition>;
  readonly additionalProperties?: boolean;
};

export type NotificationTemplate = NotificationTemplateRef & {
  readonly channel: NotificationChannel;
  readonly subject?: string;
  readonly content: string;
  readonly variablesSchema?: NotificationTemplateVariablesSchema;
  readonly variableEscaping?: NotificationTemplateVariableEscaping;
};

export type NotificationTemplateRenderRequest = NotificationTemplateRef & {
  readonly channel: NotificationChannel;
  readonly variables?: Record<string, unknown>;
};

export type NotificationTemplateRenderResult = {
  readonly template: NotificationTemplateRef;
  readonly subject?: string;
  readonly content: string;
  readonly variables: Record<string, unknown>;
};

export type NotificationTemplateSendRequest = {
  readonly to: string;
  readonly template: NotificationTemplateRef;
  readonly variables?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
};

export type NotificationTemplatePreviewRequest = NotificationTemplateRenderRequest;

export type NotificationTemplatePreviewResult = NotificationTemplateRenderResult;

export class NotificationTemplateRegistry {
  private readonly templates = new Map<string, NotificationTemplate>();

  registerTemplate(template: NotificationTemplate): void {
    const key = createNotificationTemplateKey(template);

    if (this.templates.has(key)) {
      throw new NotificationTemplateAlreadyRegisteredProblem(template);
    }

    this.templates.set(key, template);
  }

  getTemplate(ref: NotificationTemplateRef): NotificationTemplate | undefined {
    return this.templates.get(createNotificationTemplateKey(ref));
  }

  render(request: NotificationTemplateRenderRequest): NotificationTemplateRenderResult {
    const template = this.getTemplate(request);

    if (template === undefined || template.channel !== request.channel) {
      throw new NotificationTemplateNotFoundProblem(request);
    }

    const variables = request.variables ?? {};
    validateTemplateVariables(template, variables);
    const variableEscaping = template.variableEscaping ?? "html";

    return {
      template: {
        id: template.id,
        version: template.version,
        locale: template.locale,
      },
      ...(template.subject === undefined
        ? {}
        : { subject: renderTemplateString(template.subject, variables, variableEscaping) }),
      content: renderTemplateString(template.content, variables, variableEscaping),
      variables,
    };
  }
}

export function previewNotificationTemplate(
  registry: NotificationTemplateRegistry,
  request: NotificationTemplatePreviewRequest,
): NotificationTemplatePreviewResult {
  return registry.render(request);
}

export function createNotificationTemplateFixture(
  overrides: Partial<NotificationTemplate> = {},
): NotificationTemplate {
  return {
    id: "fixture-template",
    version: "v1",
    locale: "en-US",
    channel: NotificationChannel.EMAIL,
    content: "Hello {{name}}",
    variablesSchema: {
      additionalProperties: false,
      properties: {
        name: { type: "string", required: true },
      },
    },
    ...overrides,
  };
}

export function createNotificationTemplateKey(ref: NotificationTemplateRef): string {
  return [ref.id, ref.version, ref.locale].map(encodeURIComponent).join(":");
}

function validateTemplateVariables(
  template: NotificationTemplate,
  variables: Record<string, unknown>,
): void {
  const issues: string[] = [];
  const schema = template.variablesSchema;

  if (schema !== undefined) {
    for (const [name, definition] of Object.entries(schema.properties)) {
      if (variables[name] === undefined) {
        if (definition.required) {
          issues.push(`${name} is required`);
        }

        continue;
      }

      if (!matchesTemplateVariableType(variables[name], definition.type)) {
        issues.push(`${name} must be ${definition.type}`);
      }
    }

    if (schema.additionalProperties === false) {
      const knownNames = new Set(Object.keys(schema.properties));

      for (const name of Object.keys(variables).sort()) {
        if (!knownNames.has(name)) {
          issues.push(`${name} is not allowed`);
        }
      }
    }
  }

  for (const name of extractTemplatePlaceholders(template)) {
    if (variables[name] === undefined) {
      issues.push(`${name} is required by template`);
    }
  }

  if (issues.length > 0) {
    throw new NotificationTemplateVariablesInvalidProblem(template, issues);
  }
}

function extractTemplatePlaceholders(template: NotificationTemplate): string[] {
  const placeholders = new Set<string>();

  collectTemplatePlaceholders(template.content, placeholders);

  if (template.subject !== undefined) {
    collectTemplatePlaceholders(template.subject, placeholders);
  }

  return [...placeholders].sort();
}

function collectTemplatePlaceholders(value: string, placeholders: Set<string>): void {
  for (const match of value.matchAll(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g)) {
    const name = match[1];

    if (name !== undefined) {
      placeholders.add(name);
    }
  }
}

function renderTemplateString(
  value: string,
  variables: Record<string, unknown>,
  variableEscaping: NotificationTemplateVariableEscaping,
): string {
  return value.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_match, name: string) =>
    stringifyTemplateVariable(variables[name], variableEscaping),
  );
}

function stringifyTemplateVariable(
  value: unknown,
  variableEscaping: NotificationTemplateVariableEscaping,
): string {
  let stringValue: string;

  if (typeof value === "string") {
    stringValue = value;
  } else if (typeof value === "number" || typeof value === "boolean") {
    stringValue = String(value);
  } else {
    stringValue = JSON.stringify(value) ?? String(value);
  }

  return variableEscaping === "html" ? escapeHtml(stringValue) : stringValue;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function matchesTemplateVariableType(
  value: unknown,
  expected: NotificationTemplateVariableType,
): boolean {
  switch (expected) {
    case "array":
      return Array.isArray(value);
    case "boolean":
      return typeof value === "boolean";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "string":
      return typeof value === "string";
  }
}
