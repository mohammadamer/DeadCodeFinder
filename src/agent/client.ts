import { CopilotClient } from "@github/copilot-sdk";
import { createAnalysisSession } from "./session.js";
import { resetSharedProject } from "./tools.js";
import type { DeadCodeFinding } from "../analysis/types.js";
export type { ScanResult } from "./scanner.js";
import type { ScanResult } from "./scanner.js";

/**
 * Run the dead code scan using the Copilot SDK agent.
 * The agent orchestrates the analysis tools and applies reasoning to filter false positives.
 */
export async function scanForDeadCode(
  targetPath: string,
  options?: { model?: string }
): Promise<ScanResult> {
  const client = new CopilotClient();

  try {
    await client.start();

    const session = await createAnalysisSession(client, {
      targetPath,
      model: options?.model,
    });

    const response = await session.sendAndWait({
      prompt: `Scan the project at "${targetPath}" for dead code. Use the detect_dead_code tool to run the static analysis, then review the findings and filter out any false positives using your judgment. Return the final refined findings as JSON.`,
    });

    const content = response?.data.content || "";

    // Try to parse the agent's response as JSON
    const parsed = extractJsonFromResponse(content);

    if (parsed) {
      return {
        findings: parsed.findings || [],
        summary: buildSummary(parsed.findings || []),
        agentSummary: parsed.summary || "Analysis complete.",
      };
    }

    // If we can't parse JSON, return a fallback indicating the agent couldn't complete
    return {
      findings: [],
      summary: { unusedFunctions: 0, orphanedModules: 0, deadApis: 0, unreachableCode: 0, total: 0 },
      agentSummary: content || "Agent did not return structured results.",
    };
  } finally {
    resetSharedProject();
    await client.stop();
  }
}

function buildSummary(findings: DeadCodeFinding[]) {
  return {
    unusedFunctions: findings.filter((f) => f.type === "unused-function").length,
    orphanedModules: findings.filter((f) => f.type === "orphaned-module").length,
    deadApis: findings.filter((f) => f.type === "dead-api").length,
    unreachableCode: findings.filter((f) => f.type === "unreachable-code").length,
    total: findings.length,
  };
}

function extractJsonFromResponse(content: string): any | null {
  // Try direct parse
  try {
    return JSON.parse(content);
  } catch {
    // noop
  }

  // Try to find JSON block in markdown code fence
  const jsonMatch = content.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {
      // noop
    }
  }

  // Try to find a JSON object in the text
  const objectMatch = content.match(/\{[\s\S]*"findings"[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch {
      // noop
    }
  }

  return null;
}
