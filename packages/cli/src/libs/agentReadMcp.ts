import { CLI_DIAGNOSTIC_CODES } from "./diagnosticCodes.js";
import { McpServer } from "@modelcontextprotocol/server";
import type { createAgentReadTools } from "./agentReadTools.js";

export function isAgentReadFailure(result: unknown): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    "status" in result &&
    result.status !== "verified"
  );
}

export function createAgentReadMcpServer(
  tools: ReturnType<typeof createAgentReadTools>,
): McpServer {
  const server = new McpServer({ name: "croco-agent-read", version: "1.0.0" });
  for (const tool of tools.tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      },
      async (input, context) => {
        try {
          const result = await tools.call(tool.name, input, context.mcpReq.signal);
          return {
            content: [{ type: "text", text: JSON.stringify(result) }],
            isError: isAgentReadFailure(result),
          };
        } catch {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "error",
                  code: CLI_DIAGNOSTIC_CODES.agentReadInternalError,
                }),
              },
            ],
            isError: true,
          };
        }
      },
    );
  }
  return server;
}
