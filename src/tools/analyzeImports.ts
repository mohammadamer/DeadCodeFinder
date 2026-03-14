import { Project } from "ts-morph";
import type { ImportReference } from "../analysis/types.js";

interface AnalyzeImportsResult {
  imports: ImportReference[];
  totalImports: number;
}

/**
 * Analyze all imports across the project, mapping which symbols are imported from where.
 */
export function analyzeImports(project: Project): AnalyzeImportsResult {
  const allImports: ImportReference[] = [];

  for (const sf of project.getSourceFiles()) {
    const sfPath = sf.getFilePath().replace(/\\/g, "/");

    for (const importDecl of sf.getImportDeclarations()) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      const resolvedSourceFile = importDecl.getModuleSpecifierSourceFile();
      const resolvedPath = resolvedSourceFile
        ? resolvedSourceFile.getFilePath().replace(/\\/g, "/")
        : null;
      const line = importDecl.getStartLineNumber();

      // Default import
      const defaultImport = importDecl.getDefaultImport();
      if (defaultImport) {
        allImports.push({
          importedName: defaultImport.getText(),
          fromModule: moduleSpecifier,
          resolvedFilePath: resolvedPath,
          importingFilePath: sfPath,
          line,
          isDefault: true,
          isNamespace: false,
        });
      }

      // Namespace import: import * as foo from "..."
      const namespaceImport = importDecl.getNamespaceImport();
      if (namespaceImport) {
        allImports.push({
          importedName: namespaceImport.getText(),
          fromModule: moduleSpecifier,
          resolvedFilePath: resolvedPath,
          importingFilePath: sfPath,
          line,
          isDefault: false,
          isNamespace: true,
        });
      }

      // Named imports: import { a, b } from "..."
      for (const namedImport of importDecl.getNamedImports()) {
        allImports.push({
          importedName: namedImport.getName(),
          fromModule: moduleSpecifier,
          resolvedFilePath: resolvedPath,
          importingFilePath: sfPath,
          line,
          isDefault: false,
          isNamespace: false,
        });
      }
    }

    // Also track re-exports: export { foo } from "./bar"
    for (const exportDecl of sf.getExportDeclarations()) {
      const moduleSpecifier = exportDecl.getModuleSpecifierValue();
      if (!moduleSpecifier) continue; // export { foo } without "from" is not an import

      const resolvedSourceFile = exportDecl.getModuleSpecifierSourceFile();
      const resolvedPath = resolvedSourceFile
        ? resolvedSourceFile.getFilePath().replace(/\\/g, "/")
        : null;
      const line = exportDecl.getStartLineNumber();

      for (const namedExport of exportDecl.getNamedExports()) {
        allImports.push({
          importedName: namedExport.getName(),
          fromModule: moduleSpecifier,
          resolvedFilePath: resolvedPath,
          importingFilePath: sfPath,
          line,
          isDefault: false,
          isNamespace: false,
        });
      }
    }
  }

  return {
    imports: allImports,
    totalImports: allImports.length,
  };
}
