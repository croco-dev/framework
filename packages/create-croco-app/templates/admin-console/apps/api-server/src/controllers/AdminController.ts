import { ProblemCategory } from "@croco/problems-core";
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  ProblemResponse,
  Query,
  ResponseSchema,
} from "@croco/protocols-rest";
import { z } from "zod";
import { getAdminConsoleService } from "../admin";
import {
  adminConsoleSnapshotSchema,
  adminOperationSchema,
  adminUserSchema,
  createAdminUserInputSchema,
  tenantIdSchema,
  type AdminConsoleSnapshot,
  type AdminOperation,
  type AdminUser,
  type CreateAdminUserInput,
} from "./adminSchemas";

@Controller("/admin")
export class AdminController {
  @Get("/snapshot")
  @ResponseSchema(adminConsoleSnapshotSchema)
  async snapshot(
    @Query("tenantId", tenantIdSchema.optional()) tenantId?: string,
  ): Promise<AdminConsoleSnapshot> {
    return await getAdminConsoleService().snapshot(tenantId);
  }

  @Get("/users")
  @ResponseSchema(z.array(adminUserSchema))
  async listUsers(
    @Query("tenantId", tenantIdSchema.optional()) tenantId?: string,
  ): Promise<ReadonlyArray<AdminUser>> {
    return await getAdminConsoleService().listUsers(tenantId);
  }

  @Get("/users/:id")
  @ProblemResponse({
    code: "admin-console/user-not-found",
    category: ProblemCategory.NotFound,
    description: "The requested admin user does not exist in the selected tenant context.",
  })
  @ResponseSchema(adminUserSchema)
  async getUser(
    @Param("id", z.string().min(1)) id: string,
    @Query("tenantId", tenantIdSchema.optional()) tenantId?: string,
  ): Promise<AdminUser> {
    return await getAdminConsoleService().getUser(id, tenantId);
  }

  @Post("/users")
  @ResponseSchema(adminUserSchema)
  async createUser(
    @Body(createAdminUserInputSchema) input: CreateAdminUserInput,
  ): Promise<AdminUser> {
    return await getAdminConsoleService().createUser(input);
  }

  @Get("/operations")
  @ResponseSchema(z.array(adminOperationSchema))
  async listOperations(
    @Query("tenantId", tenantIdSchema.optional()) tenantId?: string,
  ): Promise<ReadonlyArray<AdminOperation>> {
    return await getAdminConsoleService().listOperations(tenantId);
  }
}
