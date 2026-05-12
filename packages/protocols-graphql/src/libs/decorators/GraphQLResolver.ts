import "reflect-metadata";
import type { Scope } from "@croco/framework-context";
import { Container, MetadataStorage } from "@croco/framework-context";
import { Resolver } from "type-graphql";
import { RESOLVER_KEY, RESOLVERS_KEY } from "../constants";
import type { ClassType, GraphQLResolverMetadata } from "../types";

export type GraphQLResolverOptions = {
  scope?: Scope;
};

export function GraphQLResolver<T extends object = object>(
  objectFunc?: ClassType<T> | GraphQLResolverOptions,
): ClassDecorator {
  return (target: Function): void => {
    const scope: Scope =
      objectFunc && typeof objectFunc !== "function"
        ? ((objectFunc as GraphQLResolverOptions).scope ?? "singleton")
        : "singleton";

    Container.register(target as unknown as ClassType, scope);

    if (objectFunc && typeof objectFunc === "function") {
      Resolver(objectFunc as unknown as ClassType)(target);
    } else {
      Resolver()(target);
    }

    const metadata: GraphQLResolverMetadata = { target };
    Reflect.defineMetadata(RESOLVER_KEY, metadata, target);

    MetadataStorage.define(RESOLVERS_KEY, target, true);
  };
}
