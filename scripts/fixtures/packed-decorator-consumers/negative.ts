import {
  Body,
  Get,
  HttpMethod,
  Param,
  Post,
  Query,
  defineRouteContract,
} from "@croco/protocols-rest";
import { z } from "zod";

const getContract = defineRouteContract({
  method: HttpMethod.GET,
  path: "/users/:id",
  params: z.object({ id: z.coerce.number() }),
  query: z.object({ view: z.string() }),
  response: z.object({ id: z.number() }),
});

const postContract = defineRouteContract({
  method: HttpMethod.POST,
  path: "/users",
  body: z.object({ name: z.string() }),
  response: z.object({ id: z.number() }),
});

class NegativeController {
  // EXPECT_ERROR:return-type
  @Get(getContract)
  invalidReturn(): Promise<string> {
    return Promise.resolve("wrong");
  }

  validGet(
    // EXPECT_ERROR:param-type
    @Param(getContract, "id") id: string,
    // EXPECT_ERROR:query-type
    @Query(getContract, "view") view: number,
  ): { id: number } {
    return { id: Number(id) + view };
  }

  @Post(postContract)
  invalidBody(
    // EXPECT_ERROR:body-type
    @Body(postContract) body: number,
  ): { id: number } {
    return { id: body };
  }

  // EXPECT_ERROR:method-mismatch
  @Get(postContract)
  invalidMethod(): { id: number } {
    return { id: 1 };
  }

  invalidPathKey(
    // EXPECT_ERROR:path-key
    @Param(getContract, "missing") value: number,
  ): void {
    void value;
  }

  invalidQueryKey(
    // EXPECT_ERROR:query-key
    @Query(getContract, "missing") value: string,
  ): void {
    void value;
  }
}

void NegativeController;
