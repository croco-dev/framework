import "reflect-metadata";
import { Container } from "@croco/framework-context";
import { Body, Controller, Post } from "@croco/protocols-rest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  handleJsonResult,
  toProblemFormProblem,
  type ProblemDeclaration,
} from "../../../frontend-problems/src/index";
import { createApp } from "../index";

describe("REST form validation Problem", () => {
  it("maps a real HTTP body-validation response to declared form fields", async () => {
    @Controller("/form-validation")
    class FormValidationController {
      @Post()
      submit(
        @Body(z.object({ name: z.string().min(1), email: z.string().email() })) _body: unknown,
      ) {
        return { accepted: true };
      }
    }

    Container.reset();
    const app = createApp({
      controllers: [FormValidationController],
      securityValidation: "off",
      diValidation: "off",
    });
    const response = await app.fetch(
      new Request("http://localhost/form-validation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", email: "invalid" }),
      }),
    );
    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain("application/problem+json");

    const declarations = [
      {
        code: "protocols-rest/request-validation-failed",
        category: "ValidationError",
        status: 422,
      },
    ] as const satisfies readonly ProblemDeclaration[];
    const result = await handleJsonResult<unknown, (typeof declarations)[number]>(
      response,
      declarations,
    );
    if (result.ok || result.kind !== "problem") {
      expect.fail("Expected a declared request validation Problem.");
    }

    const formProblem = toProblemFormProblem<"name" | "email", (typeof declarations)[number]>(
      result,
      ["name", "email"],
    );
    expect(formProblem).toMatchObject({
      kind: "field-validation",
      fields: {
        name: ["String must contain at least 1 character(s)"],
        email: ["Invalid email"],
      },
      problem: {
        issues: [
          { path: "body.name", message: "String must contain at least 1 character(s)" },
          { path: "body.email", message: "Invalid email" },
        ],
      },
    });
  });
});
