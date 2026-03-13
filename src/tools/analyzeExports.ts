import { Project, SyntaxKind, Node } from "ts-morph";
import type { ExportedSymbol } from "../analysis/types.js";

interface AnalyzeExportsResult {
  exports: ExportedSymbol[];
  totalExports: number;
}

/**
 * Analyze a specific file (or all files) and extract all exported symbols.
 */
export function analyzeExports(
  project: Project,
  filePath?: string
): AnalyzeExportsResult {
  const sourceFiles = filePath
    ? [project.getSourceFileOrThrow(filePath)]
    : project.getSourceFiles();

  const allExports: ExportedSymbol[] = [];

  for (const sf of sourceFiles) {
    const sfPath = sf.getFilePath().replace(/\\/g, "/");

    for (const exportedDecl of sf.getExportedDeclarations()) {
      const [name, declarations] = exportedDecl;

      for (const decl of declarations) {
        const kind = getSymbolKind(decl);
        const line = decl.getStartLineNumber();
        const isDefault = name === "default";

        allExports.push({
          name: isDefault ? getDefaultExportName(decl) || "default" : name,
          kind,
          line,
          filePath: sfPath,
          isDefault,
        });
      }
    }
  }

  return {
    exports: allExports,
    totalExports: allExports.length,
  };
}

function getSymbolKind(
  node: Node
): ExportedSymbol["kind"] {
  if (Node.isFunctionDeclaration(node) || Node.isFunctionExpression(node) || Node.isArrowFunction(node)) {
    return "function";
  }
  if (Node.isClassDeclaration(node) || Node.isClassExpression(node)) {
    return "class";
  }
  if (Node.isInterfaceDeclaration(node)) {
    return "interface";
  }
  if (Node.isTypeAliasDeclaration(node)) {
    return "type";
  }
  if (Node.isEnumDeclaration(node)) {
    return "enum";
  }
  return "variable";
}

function getDefaultExportName(node: Node): string | null {
  if (Node.isFunctionDeclaration(node)) {
    return node.getName() || null;
  }
  if (Node.isClassDeclaration(node)) {
    return node.getName() || null;
  }
  return null;
}
