import {
  NotificationTemplateAlreadyRegisteredProblem,
  NotificationTemplateNotFoundProblem,
  NotificationTemplateVariablesInvalidProblem,
  NotificationTemplateInvalidProblem,
} from "./problems/NotificationProblems";
import { NotificationChannel } from "./types";
import type { PushContent } from "./types";

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
  readonly content: string;
  readonly variablesSchema?: NotificationTemplateVariablesSchema;
  readonly variableEscaping?: NotificationTemplateVariableEscaping;
} & (
    | {
        readonly channel: NotificationChannel.PUSH;
        /** Rendered as PushContent.title; content is rendered as PushContent.body. */
        readonly subject: string;
        readonly push?: Omit<PushContent, "title" | "body">;
      }
    | {
        readonly channel: Exclude<NotificationChannel, NotificationChannel.PUSH>;
        readonly subject?: string;
        readonly push?: never;
      }
  );

export type NotificationTemplateRenderRequest = NotificationTemplateRef & {
  readonly channel: NotificationChannel;
  readonly variables?: Record<string, unknown>;
};

export type NotificationTemplateRenderResult = {
  readonly template: NotificationTemplateRef;
  readonly subject?: string;
  readonly content: string;
  readonly push?: PushContent;
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

    if (template.channel === NotificationChannel.PUSH) {
      validatePushTemplateText(template, template.subject, template.content);
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
    const defaultVariableEscaping: NotificationTemplateVariableEscaping =
      template.channel === NotificationChannel.EMAIL ? "html" : "none";
    const variableEscaping = template.variableEscaping ?? defaultVariableEscaping;
    const subject =
      template.subject === undefined
        ? undefined
        : renderTemplateString(template.subject, variables, "none");
    const content = renderTemplateString(template.content, variables, variableEscaping);

    let push: PushContent | undefined;
    if (template.channel === NotificationChannel.PUSH) {
      validatePushTemplateText(template, subject, content);
      push = {
        ...template.push,
        title: subject,
        body: content,
        ...(template.push?.deepLink === undefined
          ? {}
          : { deepLink: renderTemplateString(template.push.deepLink, variables, "none") }),
        ...(template.push?.imageUrl === undefined
          ? {}
          : { imageUrl: renderTemplateString(template.push.imageUrl, variables, "none") }),
        ...(template.push?.collapseKey === undefined
          ? {}
          : {
              collapseKey: renderTemplateString(template.push.collapseKey, variables, "none"),
            }),
        ...(template.push?.data === undefined
          ? {}
          : {
              data: Object.fromEntries(
                Object.entries(template.push.data).map(([key, value]) => [
                  key,
                  renderTemplateString(value, variables, "none"),
                ]),
              ),
            }),
      };
    }

    return {
      template: {
        id: template.id,
        version: template.version,
        locale: template.locale,
      },
      ...(subject === undefined ? {} : { subject }),
      content,
      ...(push === undefined ? {} : { push }),
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
  const { channel = NotificationChannel.EMAIL, ...fields } = overrides;
  const template = {
    id: "fixture-template",
    version: "v1",
    locale: "en-US",
    content: "Hello {{name}}",
    variablesSchema: {
      additionalProperties: false,
      properties: { name: { type: "string" as const, required: true } },
    },
    ...fields,
  };
  if (channel === NotificationChannel.PUSH) {
    return { ...template, channel, subject: overrides.subject ?? "Hello {{name}}" };
  }
  return { ...template, channel, push: undefined };
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
      const value = getOwnTemplateVariable(variables, name);
      if (value === undefined) {
        if (definition.required) {
          issues.push(`${name} is required`);
        }

        continue;
      }

      if (!matchesTemplateVariableType(value, definition.type)) {
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

  const optionalVariables = new Set(
    Object.entries(schema?.properties ?? {})
      .filter(([, definition]) => definition.required !== true)
      .map(([name]) => name),
  );

  for (const name of extractTemplatePlaceholders(template)) {
    if (getOwnTemplateVariable(variables, name) === undefined && !optionalVariables.has(name)) {
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
  if (template.channel === NotificationChannel.PUSH && template.push !== undefined) {
    for (const value of [
      template.push.deepLink,
      template.push.imageUrl,
      template.push.collapseKey,
      ...Object.values(template.push.data ?? {}),
    ]) {
      if (value !== undefined) collectTemplatePlaceholders(value, placeholders);
    }
  }

  return [...placeholders].sort();
}

function validatePushTemplateText(
  template: Extract<NotificationTemplate, { channel: NotificationChannel.PUSH }>,
  subject: string | undefined,
  content: string,
): asserts subject is string {
  const issues: string[] = [];
  if (typeof subject !== "string" || !subject.trim())
    issues.push("PUSH subject must be a non-empty title");
  if (typeof content !== "string" || !content.trim())
    issues.push("PUSH content must be a non-empty body");
  if (issues.length > 0) throw new NotificationTemplateInvalidProblem(template, issues);
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
    stringifyTemplateVariable(getOwnTemplateVariable(variables, name), variableEscaping),
  );
}

function getOwnTemplateVariable(variables: Record<string, unknown>, name: string): unknown {
  return Object.hasOwn(variables, name) ? variables[name] : undefined;
}

function stringifyTemplateVariable(
  value: unknown,
  variableEscaping: NotificationTemplateVariableEscaping,
): string {
  let stringValue: string;

  if (value === undefined) {
    stringValue = "";
  } else if (typeof value === "string") {
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
