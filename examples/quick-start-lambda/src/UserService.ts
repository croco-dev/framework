import { Component } from "@croco/framework-context";

export type User = {
  readonly id: string;
  readonly name: string;
};

export type CreateUserBody = {
  readonly name: string;
};

@Component()
export class UserService {
  private users: User[] = [
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
  ];

  list(): readonly User[] {
    return [...this.users];
  }

  create(body: CreateUserBody): User {
    const user = { id: String(this.users.length + 1), name: body.name };
    this.users = [...this.users, user];
    return user;
  }
}
