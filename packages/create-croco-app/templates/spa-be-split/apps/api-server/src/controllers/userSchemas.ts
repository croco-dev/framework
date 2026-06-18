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

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
