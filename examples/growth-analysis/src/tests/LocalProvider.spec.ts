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
