import { Project, Node, type ReferencedSymbol } from "ts-morph";
import type { UsageResult } from "../analysis/types.js";

/**
 * Find all references to a specific symbol in a specific file across the entire project.
 * Uses ts-morph's findReferences() which wraps the TypeScript language service.
 */
export function findUsages(
  project: Project,
  filePath: string,
  symbolName: string
): UsageResult {
  const sourceFile = project.getSourceFile(filePath);
  if (!sourceFile) {
    return {
      symbolName,
      filePath,
      references: [],
      externalReferenceCount: 0,
    };
  }

  const normalizedFilePath = sourceFile.getFilePath().replace(/\\/g, "/");

  // Find the declaration node for this symbol
  const declNode = findDeclarationNode(sourceFile, symbolName);
  if (!declNode) {
    return {
      symbolName,
      filePath: normalizedFilePath,
      references: [],
      externalReferenceCount: 0,
    };
  }

  // Use ts-morph's findReferences — cast to the specific node type
  const referencedSymbols: ReferencedSymbol[] = (declNode as any).findReferences?.() ?? [];

  const references: UsageResult["references"] = [];

  for (const refSymbol of referencedSymbols) {
    for (const ref of refSymbol.getReferences()) {
      const refFile = ref.getSourceFile().getFilePath().replace(/\\/g, "/");
      references.push({
        filePath: refFile,
        line: ref.getTextSpan().getStart(),
        isDefinition: ref.isDefinition() ?? false,
      });
    }
  }

  // External references = references that are NOT in the declaring file and NOT definitions
  const externalReferenceCount = references.filter(
    (r) => r.filePath !== normalizedFilePath && !r.isDefinition
  ).length;

  return {
    symbolName,
    filePath: normalizedFilePath,
    references,
    externalReferenceCount,
  };
}

/**
 * Find the declaration node for a named symbol in a source file.
 */
function findDeclarationNode(
  sourceFile: ReturnType<Project["getSourceFileOrThrow"]>,
  symbolName: string
): Node | null {
  // Check exported declarations first
  const exportedDecls = sourceFile.getExportedDeclarations();
  for (const [name, decls] of exportedDecls) {
    if (name === symbolName && decls.length > 0) {
      return decls[0];
    }
  }

  // Check top-level functions
  for (const fn of sourceFile.getFunctions()) {
    if (fn.getName() === symbolName) return fn;
  }

  // Check top-level classes
  for (const cls of sourceFile.getClasses()) {
    if (cls.getName() === symbolName) return cls;
  }

  // Check top-level variables
  for (const stmt of sourceFile.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      if (decl.getName() === symbolName) return decl;
    }
  }

  // Check interfaces
  for (const iface of sourceFile.getInterfaces()) {
    if (iface.getName() === symbolName) return iface;
  }

  // Check type aliases
  for (const alias of sourceFile.getTypeAliases()) {
    if (alias.getName() === symbolName) return alias;
  }

  // Check enums
  for (const enumDecl of sourceFile.getEnums()) {
    if (enumDecl.getName() === symbolName) return enumDecl;
  }

  return null;
}
