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

const GET_CONTRACT = defineRouteContract({
  method: HttpMethod.GET,
  path: "/users/:id",
  params: z.object({ id: z.coerce.number() }),
  query: z.object({ view: z.string() }),
  response: z.object({ id: z.number() }),
});

const POST_CONTRACT = defineRouteContract({
  method: HttpMethod.POST,
  path: "/users",
  body: z.object({ name: z.string() }),
  response: z.object({ id: z.number() }),
});

class NegativeController {
  // EXPECT_ERROR:return-type
  @Get(GET_CONTRACT)
  invalidReturn(): Promise<string> {
    return Promise.resolve("wrong");
  }

  validGet(
    // EXPECT_ERROR:param-type
    @Param(GET_CONTRACT, "id") id: string,
    // EXPECT_ERROR:query-type
    @Query(GET_CONTRACT, "view") view: number,
  ): { id: number } {
    return { id: Number(id) + view };
  }

  @Post(POST_CONTRACT)
  invalidBody(
    // EXPECT_ERROR:body-type
    @Body(POST_CONTRACT) body: number,
  ): { id: number } {
    return { id: body };
  }

  // EXPECT_ERROR:method-mismatch
  @Get(POST_CONTRACT)
  invalidMethod(): { id: number } {
    return { id: 1 };
  }

  invalidPathKey(
    // EXPECT_ERROR:path-key
    @Param(GET_CONTRACT, "missing") value: number,
  ): void {
    void value;
  }

  invalidQueryKey(
    // EXPECT_ERROR:query-key
    @Query(GET_CONTRACT, "missing") value: string,
  ): void {
    void value;
  }
}

void NegativeController;
