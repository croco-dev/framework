import { render, toPlainText } from "@react-email/render";
import { createElement, Fragment, type ReactElement, type ReactNode } from "react";

import type { EmailContent } from "@croco/engagement-core";
import { Problem, ProblemCategory } from "@croco/problems-core";

export type ReactEmailInput = Readonly<{
  subject: string;
  preview?: string;
  body: ReactElement;
  text?: string;
  replyTo?: string;
  headers?: Readonly<Record<string, string>>;
}>;

export type ReactEmailRenderOptions = Readonly<{
  preview?: string;
}>;

export async function renderReactEmail(
  body: ReactElement,
  options: ReactEmailRenderOptions = {},
): Promise<string> {
  try {
    return await render(withPreview(body, options.preview));
  } catch {
    throw new ReactEmailRenderProblem("html");
  }
}

export async function reactEmail(input: ReactEmailInput): Promise<EmailContent> {
  const html = await renderReactEmail(input.body, { preview: input.preview });
  const text = input.text ?? renderPlainText(html);

  return {
    subject: input.subject,
    html,
    text,
    ...(input.replyTo === undefined ? {} : { replyTo: input.replyTo }),
    ...(input.headers === undefined ? {} : { headers: input.headers }),
  };
}

function renderPlainText(html: string): string {
  try {
    return toPlainText(html);
  } catch {
    throw new ReactEmailRenderProblem("plain-text");
  }
}

export class ReactEmailRenderProblem extends Problem {
  constructor(mode: "html" | "plain-text") {
    super(
      "notifications-react-email/render-failed",
      ProblemCategory.InternalServerError,
      `React Email ${mode} rendering failed`,
      { extensions: { mode, retryable: false } },
    );
  }
}

function withPreview(body: ReactElement, preview: string | undefined): ReactNode {
  if (preview === undefined) {
    return body;
  }

  return createElement(
    Fragment,
    undefined,
    createElement(
      "div",
      {
        "data-skip-in-text": "true",
        style: {
          display: "none",
          maxHeight: 0,
          maxWidth: 0,
          opacity: 0,
          overflow: "hidden",
        },
      },
      preview,
    ),
    body,
  );
}
