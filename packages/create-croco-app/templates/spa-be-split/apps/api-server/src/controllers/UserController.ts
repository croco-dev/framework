import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  ResponseSchema,
} from "@croco/protocols-rest";
import { z } from "zod";
import {
  createUserInputSchema,
  deletedResponseSchema,
  type CreateUserInput,
  type User,
  userIdSchema,
  userSchema,
} from "./userSchemas";
import { getUserService } from "../users";

@Controller("/users")
export class UserController {
  @Get()
  @ResponseSchema(z.array(userSchema))
  async list(): Promise<ReadonlyArray<User>> {
    return await getUserService().list();
  }

  @Get("/:id")
  @ResponseSchema(userSchema)
  async getById(@Param("id", userIdSchema) id: string): Promise<User> {
    return await getUserService().getById(id);
  }

  @Post()
  @ResponseSchema(userSchema)
  async create(@Body(createUserInputSchema) input: CreateUserInput): Promise<User> {
    return await getUserService().create(input);
  }

  @Put("/:id")
  @ResponseSchema(userSchema)
  async update(
    @Param("id", userIdSchema) id: string,
    @Body(createUserInputSchema) input: CreateUserInput,
  ): Promise<User> {
    return await getUserService().update(id, input);
  }

  @Delete("/:id")
  @ResponseSchema(deletedResponseSchema)
  async delete(@Param("id", userIdSchema) id: string): Promise<{ deleted: boolean }> {
    return await getUserService().delete(id);
  }
}
