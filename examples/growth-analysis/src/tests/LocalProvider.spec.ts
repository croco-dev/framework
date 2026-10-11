import { request } from "node:http";
import { setTimeout } from "node:timers/promises";
import { expect, it } from "vitest";
import { startLocalProvider } from "../localProvider";

it("preserves a Korean question fragmented inside a UTF-8 codepoint over local HTTP", async () => {
  const provider = await startLocalProvider();
  try {
    const question = "구월 활성화율은 얼마인가요?";
    const payload = {
      model: "fixture-model",
      input: JSON.stringify({ question, allowedDefinitions: [], choices: [] }),
    };
    const bytes = Buffer.from(JSON.stringify(payload));
    const split = bytes.indexOf(Buffer.from("구")) + 1;
    expect(split).toBeGreaterThan(0);
    const response = new Promise<number | undefined>((resolve, reject) => {
      const outgoing = request(
        `${provider.baseURL}/responses`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "content-length": bytes.byteLength },
        },
        (incoming) => {
          incoming.resume();
          incoming.on("end", () => resolve(incoming.statusCode));
          incoming.on("error", reject);
        },
      );
      outgoing.on("error", reject);
      outgoing.write(bytes.subarray(0, split), (error) => {
        if (error) {
          reject(error);
          outgoing.destroy();
          return;
        }
        void setTimeout(50).then(() => outgoing.end(bytes.subarray(split)));
      });
    });
    expect(await response).toBe(200);
    expect(provider.requests).toHaveLength(1);
    expect(provider.requests[0]).toEqual(payload);
    expect(JSON.parse(String(provider.requests[0].input)).question).toBe(question);
  } finally {
    await provider.close();
  }
});

it.each([
  ["malformed request JSON", "{invalid"],
  ["null request", "null"],
  ["missing model input", JSON.stringify({ model: "fixture-model" })],
  ["malformed model input JSON", JSON.stringify({ input: "{invalid" })],
  ["null model input", JSON.stringify({ input: "null" })],
  ["missing question", JSON.stringify({ input: JSON.stringify({ choices: [] }) })],
  ["non-string question", JSON.stringify({ input: JSON.stringify({ question: 1, choices: [] }) })],
  ["missing choices", JSON.stringify({ input: JSON.stringify({ question: "activation" }) })],
  [
    "invalid choice",
    JSON.stringify({ input: JSON.stringify({ question: "activation", choices: [null] }) }),
  ],
  [
    "invalid choice id",
    JSON.stringify({ input: JSON.stringify({ question: "activation", choices: [{ id: 1 }] }) }),
  ],
])("rejects %s and keeps serving valid requests", async (_case, body) => {
  const provider = await startLocalProvider();
  try {
    const response = await fetch(`${provider.baseURL}/responses`, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(1000),
    });
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("");
    const valid = await fetch(`${provider.baseURL}/responses`, {
      method: "POST",
      body: JSON.stringify({
        model: "fixture-model",
        input: JSON.stringify({ question: "activation", choices: [{ id: "activation" }] }),
      }),
      signal: AbortSignal.timeout(1000),
    });
    expect(valid.status).toBe(200);
    const result = await valid.json();
    expect(JSON.parse(result.output[0].content[0].text)).toEqual({ choiceIds: ["activation"] });
  } finally {
    await provider.close();
  }
});

it("keeps serving after a client disconnects during an incomplete request", async () => {
  const provider = await startLocalProvider();
  try {
    await new Promise<void>((resolve, reject) => {
      const outgoing = request(`${provider.baseURL}/responses`, { method: "POST" });
      outgoing.on("error", (error) => {
        if (error.message !== "socket hang up") reject(error);
      });
      outgoing.on("close", resolve);
      outgoing.write("{", (error) => {
        if (error) {
          reject(error);
          outgoing.destroy();
          return;
        }
        void setTimeout(50).then(() => outgoing.destroy());
      });
    });
    const response = await fetch(`${provider.baseURL}/responses`, {
      method: "POST",
      body: JSON.stringify({ input: JSON.stringify({ question: "activation", choices: [] }) }),
      signal: AbortSignal.timeout(1000),
    });
    expect(response.status).toBe(200);
    await response.text();
    expect(provider.requests).toHaveLength(1);
  } finally {
    await provider.close();
  }
});
