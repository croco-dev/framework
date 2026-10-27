import { Component } from "@croco/framework-context";
import { GraphQLResolver, Query } from "@croco/protocols-graphql";

let nextId = 0;

@Component()
export class Dependency {
  readonly id = ++nextId;
}

@GraphQLResolver()
export class SingletonResolver {
  constructor(readonly dependency: Dependency) {}

  @Query(() => Number)
  singleton(): number {
    return this.dependency?.id ?? -1;
  }
}

@GraphQLResolver({ scope: "request" })
export class RequestResolver {
  readonly id = ++nextId;
  constructor(readonly dependency: Dependency) {}

  @Query(() => String)
  request(): string {
    return `${this.dependency?.id ?? -1}:${this.id}`;
  }
}
