import "reflect-metadata";
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  ResponseSchema,
  UseGuards,
} from "@croco/protocols-rest";
import { z } from "zod";
import type { Context } from "hono";

export class RejectGeneratedRequest {
  canActivate(): boolean {
    return false;
  }
}

@Controller("/arguments")
export class GeneratedArgumentsController {
  @Get("/:id")
  read(@Param("id") id: string, @Query("view") view: string, @Header("x-tenant") tenant: string) {
    return { id, view, tenant };
  }

  @Post()
  create(@Body(z.object({ name: z.string().min(1) })) body: { name: string }) {
    return { name: body.name };
  }

  @Get("/guarded/check")
  @UseGuards(RejectGeneratedRequest)
  guarded(): unknown {
    return { leaked: true };
  }

  @Get("/invalid/output")
  @ResponseSchema(z.object({ count: z.number() }))
  invalidOutput(): unknown {
    return { count: "wrong" };
  }

  @Get("/raw/context")
  raw(c: Context): Response {
    return c.text(c.req.query("value") ?? "missing");
  }
}
