import { z } from "zod";
import { ProblemCategory } from "@croco/problems-core";
import { defineRouteContract, defineRouteProblem, HttpMethod } from "@croco/protocols-rest";
import { UserNotFoundProblem } from "../problems";

const userNotFoundProblem = defineRouteProblem(UserNotFoundProblem, {
  code: "starter/user-not-found",
  category: ProblemCategory.NotFound,
  description: "The requested user does not exist.",
});

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
  problems: [],
});

export const getUserRoute = defineRouteContract({
  id: "users.get",
  method: HttpMethod.GET,
  path: "/users/:id",
  operationId: "getUserById",
  params: z.object({ id: userIdSchema }),
  response: userSchema,
  problems: [userNotFoundProblem],
});

export const createUserRoute = defineRouteContract({
  id: "users.create",
  method: HttpMethod.POST,
  path: "/users",
  operationId: "createUser",
  body: createUserInputSchema,
  response: userSchema,
  problems: [],
});

export const updateUserRoute = defineRouteContract({
  id: "users.update",
  method: HttpMethod.PUT,
  path: "/users/:id",
  operationId: "updateUser",
  params: z.object({ id: userIdSchema }),
  body: createUserInputSchema,
  response: userSchema,
  problems: [userNotFoundProblem],
});

export const deleteUserRoute = defineRouteContract({
  id: "users.delete",
  method: HttpMethod.DELETE,
  path: "/users/:id",
  operationId: "deleteUser",
  params: z.object({ id: userIdSchema }),
  response: deletedResponseSchema,
  problems: [userNotFoundProblem],
});

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
