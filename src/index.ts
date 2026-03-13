export { scanForDeadCode } from "./agent/client.js";
export { scanForDeadCodeDirect } from "./agent/scanner.js";
export type { ScanResult } from "./agent/scanner.js";
export { createCleanupPR } from "./github/pr.js";
export { formatMarkdown, formatJson, filterByConfidence } from "./report/formatter.js";
export { createProject } from "./analysis/project.js";
export { detectDeadCode } from "./tools/detectDeadCode.js";
export { scanFiles } from "./tools/scanFiles.js";
export { analyzeExports } from "./tools/analyzeExports.js";
export { analyzeImports } from "./tools/analyzeImports.js";
export { findUsages } from "./tools/findUsages.js";
export type {
  DeadCodeFinding,
  DeadCodeType,
  Confidence,
  ExportedSymbol,
  ImportReference,
  FileSummary,
  ProjectAnalysis,
  ScanOptions,
  UsageResult,
} from "./analysis/types.js";
