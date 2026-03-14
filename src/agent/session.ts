import { CopilotClient } from "@github/copilot-sdk";
import type { PermissionRequest, PermissionRequestResult } from "@github/copilot-sdk";
import { buildToolDefinitions } from "./tools.js";
import { DEAD_CODE_AGENT_SYSTEM_PROMPT } from "./prompts.js";

export interface SessionConfig {
  targetPath: string;
  model?: string;
}

/**
 * Create and configure a Copilot SDK session for dead code analysis.
 */
export async function createAnalysisSession(
  client: CopilotClient,
  config: SessionConfig
) {
  const tools = buildToolDefinitions(config.targetPath);

  const session = await client.createSession({
    model: config.model || "gpt-4.1",
    systemMessage: {
      mode: "append" as const,
      content: DEAD_CODE_AGENT_SYSTEM_PROMPT,
    },
    tools,
    onPermissionRequest: async (_request: PermissionRequest): Promise<PermissionRequestResult> => {
      return { kind: "approved" };
    },
  });

  return session;
}
