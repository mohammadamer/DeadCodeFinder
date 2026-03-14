import { Project } from "ts-morph";
import type { Tool } from "@github/copilot-sdk";
import { createProject } from "../analysis/project.js";
import { scanFiles } from "../tools/scanFiles.js";
import { analyzeExports } from "../tools/analyzeExports.js";
import { analyzeImports } from "../tools/analyzeImports.js";
import { findUsages } from "../tools/findUsages.js";
import { detectDeadCode } from "../tools/detectDeadCode.js";

// Shared project instance — initialized lazily by tools
let sharedProject: Project | null = null;
let sharedTargetPath: string | null = null;

function getProject(targetPath: string): Project {
  if (!sharedProject || sharedTargetPath !== targetPath) {
    sharedProject = createProject(targetPath);
    sharedTargetPath = targetPath;
  }
  return sharedProject;
}

/**
 * Build the list of tool definitions for the Copilot SDK session.
 * Each tool wraps a static analysis function with name/description/schema/handler.
 */
export function buildToolDefinitions(targetPath: string): Tool<any>[] {
  return [
    {
      name: "scan_files",
      description:
        "Scan the target project directory to list all TypeScript/JavaScript files and identify entry points (files referenced in package.json or matching common patterns like index.ts, main.ts, app.ts).",
      parameters: {
        type: "object",
        properties: {},
      },
      handler: async () => {
        const project = getProject(targetPath);
        const result = scanFiles(project, targetPath);
        return JSON.stringify(result, null, 2);
      },
    },
    {
      name: "analyze_exports",
      description:
        "Analyze exported symbols (functions, classes, variables, types) from a specific file or all files. Returns name, kind, line number, and whether it's a default export.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description:
              "Optional: Absolute path to a specific file to analyze. If omitted, analyzes all files.",
          },
        },
      },
      handler: async (args: { filePath?: string }) => {
        const project = getProject(targetPath);
        const result = analyzeExports(project, args.filePath);
        return JSON.stringify(result, null, 2);
      },
    },
    {
      name: "analyze_imports",
      description:
        "Analyze all import statements across the entire project. Maps which symbols are imported from which modules, including re-exports.",
      parameters: {
        type: "object",
        properties: {},
      },
      handler: async () => {
        const project = getProject(targetPath);
        const result = analyzeImports(project);
        return JSON.stringify(result, null, 2);
      },
    },
    {
      name: "find_usages",
      description:
        "Find all references to a specific symbol in a specific file across the entire project. Returns the list of files and lines where the symbol is referenced, and the count of external (non-local) references.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "Absolute path to the file containing the symbol.",
          },
          symbolName: {
            type: "string",
            description: "Name of the symbol to find usages for.",
          },
        },
        required: ["filePath", "symbolName"],
      },
      handler: async (args: { filePath: string; symbolName: string }) => {
        const project = getProject(targetPath);
        const result = findUsages(project, args.filePath, args.symbolName);
        return JSON.stringify(result, null, 2);
      },
    },
    {
      name: "detect_dead_code",
      description:
        "Run the full dead code detection analysis. Cross-references exports, imports, and usages to find: unused functions, orphaned modules, dead APIs, and unreachable code. Returns structured findings with confidence levels.",
      parameters: {
        type: "object",
        properties: {},
      },
      handler: async () => {
        const project = getProject(targetPath);
        const result = detectDeadCode(project, targetPath);
        return JSON.stringify(result, null, 2);
      },
    },
  ];
}

/** Reset the shared project (useful for testing) */
export function resetSharedProject(): void {
  sharedProject = null;
  sharedTargetPath = null;
}
