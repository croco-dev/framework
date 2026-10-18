import { createLambdaHost } from "@croco/preset-lambda";
import type { LambdaContext, LambdaEvent, LambdaFetchApplication } from "@croco/preset-lambda";

export async function invokeLambdaFixture(app: LambdaFetchApplication, request: Request) {
  const url = new URL(request.url);
  const event: LambdaEvent = {
    version: "2.0",
    routeKey: "$default",
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    headers: Object.fromEntries(request.headers),
    cookies: request.headers.get("cookie")?.split("; "),
    body: request.method === "GET" ? undefined : await request.text(),
    isBase64Encoded: false,
    requestContext: {
      accountId: "local",
      apiId: "local",
      domainName: "lambda.local",
      domainPrefix: "local",
      http: {
        method: request.method,
        path: url.pathname,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test",
      },
      requestId: "lambda-request",
      routeKey: "$default",
      stage: "$default",
      time: "",
      timeEpoch: 0,
    },
  };
  const context: LambdaContext = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: "local",
    functionVersion: "$LATEST",
    invokedFunctionArn: "local",
    logGroupName: "local",
    logStreamName: "local",
    memoryLimitInMB: "128",
    awsRequestId: "lambda-request",
    getRemainingTimeInMillis: () => 5000,
    done: () => undefined,
    fail: () => undefined,
    succeed: () => undefined,
  };
  return createLambdaHost(app)(event, context);
}

export async function fetchThroughLambdaFixture(
  app: LambdaFetchApplication,
  request: Request,
): Promise<Response> {
  const result = await invokeLambdaFixture(app, request);
  const headers = new Headers(
    Object.entries(result.headers ?? {}).map(([key, value]) => [key, String(value)]),
  );
  for (const cookie of result.cookies ?? []) headers.append("set-cookie", cookie);
  const body = result.body ?? "";
  return new Response(result.isBase64Encoded ? Buffer.from(body, "base64") : body, {
    status: result.statusCode,
    headers,
  });
}
