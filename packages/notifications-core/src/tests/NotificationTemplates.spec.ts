import { describe, expect, it } from "vitest";
import {
  createNotificationTemplateFixture,
  NotificationTemplateRegistry,
  previewNotificationTemplate,
} from "../libs/NotificationTemplates";
import {
  NotificationTemplateAlreadyRegisteredProblem,
  NotificationTemplateVariablesInvalidProblem,
} from "../libs/problems/NotificationProblems";
import { NotificationChannel } from "../libs/types";

describe("NotificationTemplateRegistry", () => {
  it.each(["constructor", "toString", "__proto__"])(
    "should require an own value for %s with or without a schema",
    (name) => {
      for (const withSchema of [false, true]) {
        const registry = new NotificationTemplateRegistry();
        const template = {
          id: "own-variable",
          version: "v1",
          locale: "en-US",
          channel: NotificationChannel.EMAIL,
          subject: `Subject {{${name}}}`,
          content: `Hello {{${name}}} / {{${name}}}`,
          ...(withSchema
            ? {
                variablesSchema: {
                  properties: { [name]: { type: "string" as const, required: true } },
                },
              }
            : {}),
        };
        registry.registerTemplate(template);

        expect(() => registry.render({ ...template, variables: {} })).toThrow(
          NotificationTemplateVariablesInvalidProblem,
        );

        const variables = Object.freeze({ [name]: "<Ada & Bob>" });
        const prototype = Object.getPrototypeOf(variables);
        expect(registry.render({ ...template, variables })).toMatchObject({
          subject: "Subject <Ada & Bob>",
          content: "Hello &lt;Ada &amp; Bob&gt; / &lt;Ada &amp; Bob&gt;",
          variables,
        });
        expect(Object.getPrototypeOf(variables)).toBe(prototype);
        expect(Object.getOwnPropertyDescriptors(variables)).toEqual({
          [name]: { value: "<Ada & Bob>", writable: false, enumerable: true, configurable: false },
        });

        if (withSchema) {
          expect(() => registry.render({ ...template, variables: { [name]: 42 } })).toThrow(
            NotificationTemplateVariablesInvalidProblem,
          );
        }
      }
    },
  );

  it("should ignore inherited required and optional values without invoking their getters", () => {
    const registry = new NotificationTemplateRegistry();
    const prototype = Object.freeze({
      get required() {
        throw new Error("Inherited values must not be read");
      },
      get optional() {
        throw new Error("Inherited values must not be read");
      },
    });
    const variables: Record<string, unknown> = Object.create(prototype);
    const template = {
      id: "inherited-variables",
      version: "v1",
      locale: "en-US",
      channel: NotificationChannel.SMS,
      content: "{{required}} / {{optional}} / {{constructor}}",
      variablesSchema: {
        additionalProperties: false,
        properties: {
          required: { type: "string" as const, required: true },
          optional: { type: "string" as const },
          constructor: { type: "string" as const, required: false },
        },
      },
    };
    registry.registerTemplate(template);

    expect(() => registry.render({ ...template, variables })).toThrow(
      NotificationTemplateVariablesInvalidProblem,
    );
    Object.defineProperty(variables, "required", { value: "<Ada>", enumerable: true });
    Object.freeze(variables);
    expect(registry.render({ ...template, variables }).content).toBe("<Ada> /  / ");
    expect(Object.getPrototypeOf(variables)).toBe(prototype);
    expect(Object.keys(variables)).toEqual(["required"]);
  });

  it("should render a template after validating schema variables", () => {
    const registry = new NotificationTemplateRegistry();

    registry.registerTemplate({
      id: "invoice-ready",
      version: "v1",
      locale: "en-US",
      channel: NotificationChannel.EMAIL,
      subject: "Invoice {{invoiceNumber}}",
      content: "Hello {{name}}, your total is {{total}}.",
      variablesSchema: {
        additionalProperties: false,
        properties: {
          invoiceNumber: { type: "string", required: true },
          name: { type: "string", required: true },
          total: { type: "number", required: true },
        },
      },
    });

    expect(
      registry.render({
        id: "invoice-ready",
        version: "v1",
        locale: "en-US",
        channel: NotificationChannel.EMAIL,
        variables: {
          invoiceNumber: "INV-1",
          name: "Ada",
          total: 42,
        },
      }),
    ).toEqual({
      template: {
        id: "invoice-ready",
        version: "v1",
        locale: "en-US",
      },
      subject: "Invoice INV-1",
      content: "Hello Ada, your total is 42.",
      variables: {
        invoiceNumber: "INV-1",
        name: "Ada",
        total: 42,
      },
    });
  });

  it("should render omitted optional template variables as empty strings", () => {
    const registry = new NotificationTemplateRegistry();

    registry.registerTemplate({
      id: "optional-greeting",
      version: "v1",
      locale: "en-US",
      channel: NotificationChannel.EMAIL,
      subject: "Hello {{nickname}}",
      content: "Welcome, {{name}}{{suffix}}{{honorific}}",
      variablesSchema: {
        additionalProperties: false,
        properties: {
          name: { type: "string", required: true },
          nickname: { type: "string", required: false },
          suffix: { type: "string", required: false },
          honorific: { type: "string" },
        },
      },
    });

    expect(
      registry.render({
        id: "optional-greeting",
        version: "v1",
        locale: "en-US",
        channel: NotificationChannel.EMAIL,
        variables: {
          name: "Ada",
        },
      }),
    ).toMatchObject({
      subject: "Hello ",
      content: "Welcome, Ada",
      variables: {
        name: "Ada",
      },
    });
  });

  it("should reject invalid variables before rendering", () => {
    const registry = new NotificationTemplateRegistry();

    registry.registerTemplate({
      id: "welcome",
      version: "v1",
      locale: "en-US",
      channel: NotificationChannel.EMAIL,
      content: "Welcome {{name}}",
      variablesSchema: {
        additionalProperties: false,
        properties: {
          name: { type: "string", required: true },
        },
      },
    });

    expect(() =>
      registry.render({
        id: "welcome",
        version: "v1",
        locale: "en-US",
        channel: NotificationChannel.EMAIL,
        variables: {
          name: 123,
          unexpected: true,
        },
      }),
    ).toThrow(NotificationTemplateVariablesInvalidProblem);
  });

  it("should keep requiring declared and undeclared template variables", () => {
    const registry = new NotificationTemplateRegistry();

    registry.registerTemplate(
      createNotificationTemplateFixture({
        id: "required-greeting",
      }),
    );
    registry.registerTemplate(
      createNotificationTemplateFixture({
        id: "undeclared-greeting",
        content: "Hello {{undeclared}}",
        variablesSchema: {
          additionalProperties: false,
          properties: {},
        },
      }),
    );

    expect(() =>
      registry.render({
        id: "required-greeting",
        version: "v1",
        locale: "en-US",
        channel: NotificationChannel.EMAIL,
      }),
    ).toThrow(NotificationTemplateVariablesInvalidProblem);
    expect(() =>
      registry.render({
        id: "undeclared-greeting",
        version: "v1",
        locale: "en-US",
        channel: NotificationChannel.EMAIL,
      }),
    ).toThrow(NotificationTemplateVariablesInvalidProblem);
  });

  it("should reject duplicate template contracts", () => {
    const registry = new NotificationTemplateRegistry();
    const template = {
      id: "welcome",
      version: "v1",
      locale: "en-US",
      channel: NotificationChannel.EMAIL,
      content: "Welcome {{name}}",
    };

    registry.registerTemplate(template);

    expect(() => registry.registerTemplate(template)).toThrow(
      NotificationTemplateAlreadyRegisteredProblem,
    );
  });

  it("should preserve email subjects while escaping content variables by default", () => {
    const registry = new NotificationTemplateRegistry();

    registry.registerTemplate({
      id: "html-welcome",
      version: "v1",
      locale: "en-US",
      channel: NotificationChannel.EMAIL,
      subject: "Welcome to {{company}}",
      content: "<p>Hello {{company}}</p>",
    });

    expect(
      registry.render({
        id: "html-welcome",
        version: "v1",
        locale: "en-US",
        channel: NotificationChannel.EMAIL,
        variables: {
          company: "Ben & Jerry's",
        },
      }),
    ).toMatchObject({
      subject: "Welcome to Ben & Jerry's",
      content: "<p>Hello Ben &amp; Jerry&#39;s</p>",
    });
  });

  it("should preserve variables by default for non-html channels", () => {
    const registry = new NotificationTemplateRegistry();

    registry.registerTemplate({
      id: "sms-welcome",
      version: "v1",
      locale: "en-US",
      channel: NotificationChannel.SMS,
      content: "Hello {{name}}",
    });

    expect(
      registry.render({
        id: "sms-welcome",
        version: "v1",
        locale: "en-US",
        channel: NotificationChannel.SMS,
        variables: {
          name: "<Ada & Bob>",
        },
      }).content,
    ).toBe("Hello <Ada & Bob>");
  });

  it("should preserve subjects when content escaping is explicitly html", () => {
    const registry = new NotificationTemplateRegistry();

    registry.registerTemplate({
      id: "explicit-html",
      version: "v1",
      locale: "en-US",
      channel: NotificationChannel.EMAIL,
      subject: "Welcome to {{company}}",
      content: "<p>Welcome to {{company}}</p>",
      variableEscaping: "html",
    });

    expect(
      registry.render({
        id: "explicit-html",
        version: "v1",
        locale: "en-US",
        channel: NotificationChannel.EMAIL,
        variables: {
          company: "Ben & Jerry's",
        },
      }),
    ).toMatchObject({
      subject: "Welcome to Ben & Jerry's",
      content: "<p>Welcome to Ben &amp; Jerry&#39;s</p>",
    });
  });

  it("should allow explicit raw rendering for non-html templates", () => {
    const registry = new NotificationTemplateRegistry();

    registry.registerTemplate({
      id: "text-welcome",
      version: "v1",
      locale: "en-US",
      channel: NotificationChannel.EMAIL,
      content: "Hello {{name}}",
      variableEscaping: "none",
    });

    expect(
      registry.render({
        id: "text-welcome",
        version: "v1",
        locale: "en-US",
        channel: NotificationChannel.EMAIL,
        variables: {
          name: "<Ada>",
        },
      }).content,
    ).toBe("Hello <Ada>");
  });

  it("should preview templates with exported fixture utilities", () => {
    const registry = new NotificationTemplateRegistry();
    const template = createNotificationTemplateFixture({
      id: "fixture-preview",
      content: "Preview {{name}}",
    });

    registry.registerTemplate(template);

    expect(
      previewNotificationTemplate(registry, {
        id: "fixture-preview",
        version: "v1",
        locale: "en-US",
        channel: NotificationChannel.EMAIL,
        variables: {
          name: "Ada",
        },
      }),
    ).toMatchObject({
      content: "Preview Ada",
      template: {
        id: "fixture-preview",
        version: "v1",
        locale: "en-US",
      },
    });
  });
});
