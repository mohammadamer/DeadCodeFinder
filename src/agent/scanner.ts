import { createProject } from "../analysis/project.js";
import { detectDeadCode } from "../tools/detectDeadCode.js";
import type { DeadCodeFinding } from "../analysis/types.js";

export interface ScanResult {
  findings: DeadCodeFinding[];
  summary: {
    unusedFunctions: number;
    orphanedModules: number;
    deadApis: number;
    unreachableCode: number;
    total: number;
  };
  agentSummary: string;
}

/**
 * Run the scan in direct mode (no Copilot SDK) — uses static analysis only.
 * This is the fallback when the Copilot SDK is not available or the user wants raw results.
 */
export async function scanForDeadCodeDirect(
  targetPath: string
): Promise<ScanResult> {
  const project = createProject(targetPath);
  const result = detectDeadCode(project, targetPath);

  return {
    findings: result.findings,
    summary: result.summary,
    agentSummary: `Direct analysis complete. Found ${result.summary.total} issues.`,
  };
}
