import { Project } from "ts-morph";
import type { DeadCodeFinding, ExportedSymbol } from "../analysis/types.js";
import { scanFiles } from "./scanFiles.js";
import { analyzeExports } from "./analyzeExports.js";
import { analyzeImports } from "./analyzeImports.js";
import { findUsages } from "./findUsages.js";

interface DetectDeadCodeResult {
  findings: DeadCodeFinding[];
  summary: {
    unusedFunctions: number;
    orphanedModules: number;
    deadApis: number;
    unreachableCode: number;
    total: number;
  };
}

/**
 * Core dead code detection engine.
 * Cross-references exports, imports, and usage data to identify dead code.
 */
export function detectDeadCode(
  project: Project,
  targetPath: string
): DetectDeadCodeResult {
  const { files, entryPoints } = scanFiles(project, targetPath);
  const { exports: allExports } = analyzeExports(project);
  const { imports: allImports } = analyzeImports(project);

  const findings: DeadCodeFinding[] = [];

  // Build a map of which files are imported by at least one other file
  const importedFilePaths = new Set<string>();
  for (const imp of allImports) {
    if (imp.resolvedFilePath) {
      importedFilePaths.add(imp.resolvedFilePath);
    }
  }

  // Build a map of imported symbol names per source file
  const importedSymbolsByFile = new Map<string, Set<string>>();
  for (const imp of allImports) {
    if (imp.resolvedFilePath) {
      if (!importedSymbolsByFile.has(imp.resolvedFilePath)) {
        importedSymbolsByFile.set(imp.resolvedFilePath, new Set());
      }
      importedSymbolsByFile.get(imp.resolvedFilePath)!.add(imp.importedName);
    }
  }

  // 1) Detect orphaned modules — files never imported by any other file and not entry points
  const entryPointSet = new Set(entryPoints);
  for (const file of files) {
    if (!importedFilePaths.has(file) && !entryPointSet.has(file)) {
      // Check file isn't a type declarations file or test file
      if (isIgnoredFile(file)) continue;

      findings.push({
        type: "orphaned-module",
        filePath: file,
        symbolName: getFileName(file),
        line: 1,
        confidence: "high",
        reason: `File is never imported by any other module and is not an entry point.`,
      });
    }
  }

  // 2) Detect unused exported functions/classes/variables
  for (const exp of allExports) {
    if (isIgnoredFile(exp.filePath)) continue;

    // If the file is an entry point, only check non-default exports
    if (entryPointSet.has(exp.filePath) && exp.isDefault) continue;

    const importedNames = importedSymbolsByFile.get(exp.filePath);

    // Check if this export is imported anywhere
    const isImported = importedNames?.has(exp.name) ?? false;

    // Also check for namespace imports — if the file has a namespace import,
    // individual symbols might be used through the namespace
    const hasNamespaceImport = allImports.some(
      (imp) => imp.resolvedFilePath === exp.filePath && imp.isNamespace
    );

    if (!isImported && !hasNamespaceImport) {
      // Use findUsages for more accurate results
      const usage = findUsages(project, exp.filePath, exp.name);

      if (usage.externalReferenceCount === 0) {
        const finding = categorizeUnusedExport(exp);
        if (finding) {
          findings.push(finding);
        }
      }
    }
  }

  // 3) Detect unreachable code — internal (non-exported) functions with zero references
  for (const sf of project.getSourceFiles()) {
    const sfPath = sf.getFilePath().replace(/\\/g, "/");
    if (isIgnoredFile(sfPath)) continue;

    // Check non-exported functions
    for (const fn of sf.getFunctions()) {
      const name = fn.getName();
      if (!name) continue;
      if (fn.isExported()) continue;

      const usage = findUsages(project, sfPath, name);
      // Only the definition itself references it
      const nonDefinitionRefs = usage.references.filter((r) => !r.isDefinition);
      if (nonDefinitionRefs.length === 0) {
        findings.push({
          type: "unreachable-code",
          filePath: sfPath,
          symbolName: name,
          line: fn.getStartLineNumber(),
          confidence: "high",
          reason: `Internal function '${name}' is declared but never called anywhere.`,
        });
      }
    }

    // Check non-exported variable declarations that hold functions
    for (const stmt of sf.getVariableStatements()) {
      if (stmt.isExported()) continue;
      for (const decl of stmt.getDeclarations()) {
        const init = decl.getInitializer();
        if (!init) continue;
        const isFunction =
          init.getKind() === 218 /* ArrowFunction */ ||
          init.getKind() === 217; /* FunctionExpression */
        if (!isFunction) continue;

        const name = decl.getName();
        const usage = findUsages(project, sfPath, name);
        const nonDefinitionRefs = usage.references.filter((r) => !r.isDefinition);
        if (nonDefinitionRefs.length === 0) {
          findings.push({
            type: "unreachable-code",
            filePath: sfPath,
            symbolName: name,
            line: decl.getStartLineNumber(),
            confidence: "high",
            reason: `Internal function '${name}' is declared but never called anywhere.`,
          });
        }
      }
    }
  }

  // Build summary
  const summary = {
    unusedFunctions: findings.filter((f) => f.type === "unused-function").length,
    orphanedModules: findings.filter((f) => f.type === "orphaned-module").length,
    deadApis: findings.filter((f) => f.type === "dead-api").length,
    unreachableCode: findings.filter((f) => f.type === "unreachable-code").length,
    total: findings.length,
  };

  return { findings, summary };
}

/**
 * Categorize an unused export into a finding type.
 */
function categorizeUnusedExport(exp: ExportedSymbol): DeadCodeFinding | null {
  // Heuristic: if it looks like an API handler/route, categorize as dead-api
  const apiPatterns = /^(get|post|put|patch|delete|handle|route|api)/i;
  const isApiLike = apiPatterns.test(exp.name);

  if (isApiLike) {
    return {
      type: "dead-api",
      filePath: exp.filePath,
      symbolName: exp.name,
      line: exp.line,
      confidence: "medium",
      reason: `Exported API handler '${exp.name}' is never imported or referenced by any other module.`,
    };
  }

  if (exp.kind === "function") {
    return {
      type: "unused-function",
      filePath: exp.filePath,
      symbolName: exp.name,
      line: exp.line,
      confidence: "high",
      reason: `Exported function '${exp.name}' is never imported or referenced by any other module.`,
    };
  }

  if (exp.kind === "class" || exp.kind === "variable") {
    return {
      type: "unused-function",
      filePath: exp.filePath,
      symbolName: exp.name,
      line: exp.line,
      confidence: "high",
      reason: `Exported ${exp.kind} '${exp.name}' is never imported or referenced by any other module.`,
    };
  }

  // Types/interfaces — lower confidence, they may be used in .d.ts consumers
  if (exp.kind === "type" || exp.kind === "interface" || exp.kind === "enum") {
    return {
      type: "unused-function",
      filePath: exp.filePath,
      symbolName: exp.name,
      line: exp.line,
      confidence: "medium",
      reason: `Exported ${exp.kind} '${exp.name}' is never imported or referenced. It may be consumed externally.`,
    };
  }

  return null;
}

/** Check if a file should be ignored in analysis */
function isIgnoredFile(filePath: string): boolean {
  return (
    filePath.includes("node_modules") ||
    filePath.includes(".d.ts") ||
    filePath.includes(".test.") ||
    filePath.includes(".spec.") ||
    filePath.includes("__tests__") ||
    filePath.includes("__mocks__")
  );
}

/** Get filename from path */
function getFileName(filePath: string): string {
  return filePath.split("/").pop() || filePath;
}
