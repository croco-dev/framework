import { Body, Controller, Delete, Get, Param, Post, Put } from "@croco/protocols-rest";

type User = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
};

type CreateUserInput = {
  readonly name: string;
  readonly email: string;
};

let users: User[] = [
  { id: "user-1", name: "Ada Lovelace", email: "ada@example.com" },
  { id: "user-2", name: "Grace Hopper", email: "grace@example.com" },
];

@Controller("/users")
export class UserController {
  @Get()
  list(): User[] {
    return users;
  }

  @Get("/:id")
  getById(@Param("id") id: string): User | undefined {
    return users.find((user) => user.id === id);
  }

  @Post()
  create(@Body() input: CreateUserInput): User {
    const user = {
      id: `user-${users.length + 1}`,
      name: input.name,
      email: input.email,
    };

    users = [...users, user];

    return user;
  }

  @Put("/:id")
  update(@Param("id") id: string, @Body() input: CreateUserInput): User | undefined {
    const nextUsers = users.map((user) =>
      user.id === id ? { ...user, name: input.name, email: input.email } : user,
    );
    const updatedUser = nextUsers.find((user) => user.id === id);

    users = nextUsers;

    return updatedUser;
  }

  @Delete("/:id")
  delete(@Param("id") id: string): { readonly deleted: boolean } {
    const previousLength = users.length;
    users = users.filter((user) => user.id !== id);

    return { deleted: users.length !== previousLength };
  }
}
