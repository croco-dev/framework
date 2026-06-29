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

  it("should escape rendered variables by default", () => {
    const registry = new NotificationTemplateRegistry();

    registry.registerTemplate({
      id: "html-welcome",
      version: "v1",
      locale: "en-US",
      channel: NotificationChannel.EMAIL,
      content: "<p>Hello {{name}}</p>",
    });

    expect(
      registry.render({
        id: "html-welcome",
        version: "v1",
        locale: "en-US",
        channel: NotificationChannel.EMAIL,
        variables: {
          name: '<script>alert("x")</script>',
        },
      }).content,
    ).toBe("<p>Hello &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>");
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
