import { SourceFile } from "ts-morph";

/** Types of dead code findings */
export type DeadCodeType =
  | "unused-function"
  | "orphaned-module"
  | "dead-api"
  | "unreachable-code";

/** Confidence level for a finding */
export type Confidence = "high" | "medium" | "low";

/** A single dead code finding */
export interface DeadCodeFinding {
  type: DeadCodeType;
  filePath: string;
  symbolName: string;
  line: number;
  confidence: Confidence;
  reason: string;
}

/** Represents an exported symbol from a file */
export interface ExportedSymbol {
  name: string;
  kind: "function" | "class" | "variable" | "type" | "interface" | "enum";
  line: number;
  filePath: string;
  isDefault: boolean;
}

/** Represents an import reference */
export interface ImportReference {
  importedName: string;
  fromModule: string;
  resolvedFilePath: string | null;
  importingFilePath: string;
  line: number;
  isDefault: boolean;
  isNamespace: boolean;
}

/** Summary of a source file */
export interface FileSummary {
  filePath: string;
  exports: ExportedSymbol[];
  imports: ImportReference[];
  isEntryPoint: boolean;
}

/** Full project analysis result */
export interface ProjectAnalysis {
  files: FileSummary[];
  entryPoints: string[];
  totalFiles: number;
  totalExports: number;
  totalImports: number;
}

/** Options for the scan */
export interface ScanOptions {
  targetPath: string;
  confidenceThreshold: Confidence;
  format: "json" | "markdown";
  dryRun: boolean;
}

/** Result of a usage search for a symbol */
export interface UsageResult {
  symbolName: string;
  filePath: string;
  references: Array<{
    filePath: string;
    line: number;
    isDefinition: boolean;
  }>;
  externalReferenceCount: number;
}
