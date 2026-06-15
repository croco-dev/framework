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

const userIdSchema = z.string();
const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});
const createUserInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});
const deletedResponseSchema = z.object({
  deleted: z.boolean(),
});

type User = z.infer<typeof userSchema>;
type CreateUserInput = z.infer<typeof createUserInputSchema>;

let users: User[] = [
  { id: "user-1", name: "Ada Lovelace", email: "ada@example.com" },
  { id: "user-2", name: "Grace Hopper", email: "grace@example.com" },
];

@Controller("/users")
export class UserController {
  @Get()
  @ResponseSchema(z.array(userSchema))
  list(): User[] {
    return users;
  }

  @Get("/:id")
  @ResponseSchema(userSchema.nullable())
  getById(@Param("id", userIdSchema) id: string): User | null {
    return users.find((user) => user.id === id) ?? null;
  }

  @Post()
  @ResponseSchema(userSchema)
  create(@Body(createUserInputSchema) input: CreateUserInput): User {
    const user = {
      id: `user-${users.length + 1}`,
      name: input.name,
      email: input.email,
    };

    users = [...users, user];

    return user;
  }

  @Put("/:id")
  @ResponseSchema(userSchema.nullable())
  update(
    @Param("id", userIdSchema) id: string,
    @Body(createUserInputSchema) input: CreateUserInput,
  ): User | null {
    const nextUsers = users.map((user) =>
      user.id === id ? { ...user, name: input.name, email: input.email } : user,
    );
    const updatedUser = nextUsers.find((user) => user.id === id);

    users = nextUsers;

    return updatedUser ?? null;
  }

  @Delete("/:id")
  @ResponseSchema(deletedResponseSchema)
  delete(@Param("id", userIdSchema) id: string): z.infer<typeof deletedResponseSchema> {
    const previousLength = users.length;
    users = users.filter((user) => user.id !== id);

    return { deleted: users.length !== previousLength };
  }
}
