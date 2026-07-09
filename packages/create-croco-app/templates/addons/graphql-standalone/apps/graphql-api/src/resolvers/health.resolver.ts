import { Authorized, Query, Resolver } from "type-graphql";

@Resolver()
export class HealthResolver {
  @Query(() => String)
  health(): string {
    return "ok";
  }

  @Authorized()
  @Query(() => String)
  protectedHealth(): string {
    return "authenticated";
  }
}
