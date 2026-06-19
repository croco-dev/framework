import { defineRouteContract, HttpMethod } from "@croco/protocols-rest";
import { z } from "zod";

export const userIdSchema = z.string();
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});
export const createUserInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});
export const deletedResponseSchema = z.object({
  deleted: z.boolean(),
});

export const listUsersRoute = defineRouteContract({
  id: "users.list",
  method: HttpMethod.GET,
  path: "/users",
  operationId: "listUsers",
  response: z.array(userSchema),
});

export const getUserRoute = defineRouteContract({
  id: "users.get",
  method: HttpMethod.GET,
  path: "/users/:id",
  operationId: "getUserById",
  params: z.object({ id: userIdSchema }),
  response: userSchema,
});

export const createUserRoute = defineRouteContract({
  id: "users.create",
  method: HttpMethod.POST,
  path: "/users",
  operationId: "createUser",
  body: createUserInputSchema,
  response: userSchema,
});

export const updateUserRoute = defineRouteContract({
  id: "users.update",
  method: HttpMethod.PUT,
  path: "/users/:id",
  operationId: "updateUser",
  params: z.object({ id: userIdSchema }),
  body: createUserInputSchema,
  response: userSchema,
});

export const deleteUserRoute = defineRouteContract({
  id: "users.delete",
  method: HttpMethod.DELETE,
  path: "/users/:id",
  operationId: "deleteUser",
  params: z.object({ id: userIdSchema }),
  response: deletedResponseSchema,
});

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
