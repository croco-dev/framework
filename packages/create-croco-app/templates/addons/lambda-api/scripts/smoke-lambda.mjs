import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(new URL("../.lambda-package/package.json", import.meta.url));
const { handler, createLambdaApplication } = require("./dist/lambda.js");
const { Context } = require("@croco/framework-context");
const { TELEMETRY_RUNTIME_TOKEN } = require("@croco/telemetry-sdk-node");
const template = JSON.parse(
  readFileSync(new URL("../lambda/template.json", import.meta.url), "utf8"),
);
assert.equal(template.Resources.ApiFunction.Properties.Handler, "dist/lambda.handler");
process.env.TELEMETRY_ENABLED = "false";
function event(path, id, headers = {}) {
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: path,
    rawQueryString: "",
    headers,
    requestContext: {
      accountId: "000000000000",
      apiId: "local",
      domainName: "example.test",
      domainPrefix: "local",
      http: {
        method: "GET",
        path,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "fixture",
      },
      requestId: id,
      routeKey: "$default",
      stage: "$default",
      time: "01/Jan/2026:00:00:00 +0000",
      timeEpoch: 1767225600000,
    },
    isBase64Encoded: false,
  };
}
function context(id) {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: "local-api",
    functionVersion: "$LATEST",
    invokedFunctionArn: "arn:aws:lambda:local:000000000000:function:local-api",
    memoryLimitInMB: "512",
    awsRequestId: id,
    logGroupName: "/aws/lambda/local-api",
    logStreamName: "fixture",
    getRemainingTimeInMillis: () => 30000,
    done() {},
    fail() {},
    succeed() {},
  };
}
// Load and invoke the actual deployment entry, including its cached initialization.
const ok = await handler(event("/users", "users-one"), context("users-one"));
assert.equal(ok.statusCode, 200);
assert.ok(JSON.parse(ok.body).some((user) => user.id === "user-1"));
const missing = await handler(event("/users/missing", "missing"), context("missing"));
assert.equal(missing.statusCode, 404);
assert.equal(JSON.parse(missing.body).code, "starter/user-not-found");
await assert.rejects(
  handler({ ...event("/users", "invalid"), version: "1.0" }, context("invalid")),
  { code: "transports-http/lambda-event-invalid" },
);

// Local-only identity fixture exercises the built factory and real Host/transport.
// API Gateway IAM itself requires separate signed/unsigned live AWS evidence.
let release;
const overlap = new Promise((resolve) => {
  release = resolve;
});
let entered = 0;
const running = await createLambdaApplication({
  extraMiddlewares: [
    async (ctx, next) => {
      if (ctx.req.path !== "/users") return next();
      if (ctx.header("authorization") !== "Bearer local-fixture")
        return ctx.jsonResponse({ code: "FIXTURE_UNAUTHENTICATED" }, 401);
      const requestId = Context.getRequestId();
      entered += 1;
      if (entered === 2) release();
      await overlap;
      assert.equal(Context.getRequestId(), requestId);
      ctx.res.headers["set-cookie"] = "fixture=rotated; HttpOnly; Secure; SameSite=Lax";
      return ctx.jsonResponse({ requestId, cookie: ctx.header("cookie") });
    },
  ],
});
const telemetry = running.app.applicationRuntime.get(TELEMETRY_RUNTIME_TOKEN);
const forceFlush = telemetry.forceFlush.bind(telemetry);
let flushed = 0;
telemetry.forceFlush = async () => {
  flushed += 1;
  return forceFlush();
};
try {
  const denied = await running.handler(event("/users", "denied"), context("denied"));
  assert.equal(denied.statusCode, 401);
  const requests = ["session-a", "session-b"].map((id) => {
    const input = event("/users", id, { authorization: "Bearer local-fixture" });
    input.cookies = [`session=${id}`];
    return running.handler(input, context(id));
  });
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Concurrent invocation fixture did not complete")),
      10000,
    );
  });
  let responses;
  try {
    responses = await Promise.race([Promise.all(requests), deadline]);
  } finally {
    clearTimeout(timer);
  }
  for (const [index, response] of responses.entries()) {
    const id = ["session-a", "session-b"][index];
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), { requestId: id, cookie: `session=${id}` });
    assert.deepEqual(response.cookies, ["fixture=rotated; HttpOnly; Secure; SameSite=Lax"]);
  }
  assert.equal(flushed, 3);
  const flushFailure = new Error("local fixture flush failure");
  telemetry.forceFlush = async () => {
    throw flushFailure;
  };
  await assert.rejects(
    running.handler(event("/users", "flush-failed"), context("flush-failed")),
    (error) => error === flushFailure,
  );
} finally {
  release();
  telemetry.forceFlush = forceFlush;
  await running.close();
}
console.log(
  "Packaged Lambda API: v2 invoke, Problem, invalid event, fixture auth/cookies, concurrent request context and flush failure passed. Gateway IAM and live AWS: not verified.",
);
