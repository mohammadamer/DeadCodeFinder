import { describe, it, expect, beforeAll } from "vitest";
import * as path from "node:path";
import { Project } from "ts-morph";
import { createProject } from "../../src/analysis/project.js";
import { scanFiles } from "../../src/tools/scanFiles.js";
import { analyzeExports } from "../../src/tools/analyzeExports.js";
import { analyzeImports } from "../../src/tools/analyzeImports.js";
import { findUsages } from "../../src/tools/findUsages.js";
import { detectDeadCode } from "../../src/tools/detectDeadCode.js";

const FIXTURE_PATH = path.resolve(__dirname, "../fixtures/sample-project");

describe("Dead Code Detection", () => {
  let project: Project;

  beforeAll(() => {
    project = createProject(FIXTURE_PATH);
  });

  describe("createProject", () => {
    it("should load the sample project successfully", () => {
      const sourceFiles = project.getSourceFiles();
      expect(sourceFiles.length).toBeGreaterThanOrEqual(4);
    });

    it("should throw for non-existent path", () => {
      expect(() => createProject("/non/existent/path")).toThrow();
    });
  });

  describe("scanFiles", () => {
    it("should find all source files", () => {
      const result = scanFiles(project, FIXTURE_PATH);
      expect(result.totalFiles).toBeGreaterThanOrEqual(4);
      expect(result.files.some((f) => f.includes("utils.ts"))).toBe(true);
      expect(result.files.some((f) => f.includes("index.ts"))).toBe(true);
      expect(result.files.some((f) => f.includes("orphaned.ts"))).toBe(true);
      expect(result.files.some((f) => f.includes("api.ts"))).toBe(true);
    });

    it("should identify index.ts as an entry point", () => {
      const result = scanFiles(project, FIXTURE_PATH);
      expect(result.entryPoints.some((e) => e.includes("index.ts"))).toBe(true);
    });
  });

  describe("analyzeExports", () => {
    it("should find all exported symbols", () => {
      const result = analyzeExports(project);
      expect(result.totalExports).toBeGreaterThanOrEqual(6);

      const names = result.exports.map((e) => e.name);
      expect(names).toContain("usedFunction");
      expect(names).toContain("unusedFunction");
      expect(names).toContain("anotherUnusedFunction");
      expect(names).toContain("main");
      expect(names).toContain("getUsers");
      expect(names).toContain("postUser");
      expect(names).toContain("deleteUser");
    });

    it("should identify function kinds correctly", () => {
      const result = analyzeExports(project);
      const usedFn = result.exports.find((e) => e.name === "usedFunction");
      expect(usedFn?.kind).toBe("function");
    });
  });

  describe("analyzeImports", () => {
    it("should find imports across the project", () => {
      const result = analyzeImports(project);
      expect(result.totalImports).toBeGreaterThanOrEqual(1);

      // index.ts imports usedFunction from utils
      const usedFnImport = result.imports.find(
        (i) => i.importedName === "usedFunction" && i.importingFilePath.includes("index.ts")
      );
      expect(usedFnImport).toBeDefined();
      expect(usedFnImport?.resolvedFilePath).toContain("utils.ts");
    });
  });

  describe("findUsages", () => {
    it("should find references to usedFunction", () => {
      const utilsFile = project
        .getSourceFiles()
        .find((sf) => sf.getFilePath().includes("utils.ts"));
      expect(utilsFile).toBeDefined();

      const result = findUsages(
        project,
        utilsFile!.getFilePath(),
        "usedFunction"
      );
      // Should have references from index.ts and orphaned.ts (imports) + the definition
      expect(result.externalReferenceCount).toBeGreaterThanOrEqual(1);
    });

    it("should find zero external references for unusedFunction", () => {
      const utilsFile = project
        .getSourceFiles()
        .find((sf) => sf.getFilePath().includes("utils.ts"));
      expect(utilsFile).toBeDefined();

      const result = findUsages(
        project,
        utilsFile!.getFilePath(),
        "unusedFunction"
      );
      expect(result.externalReferenceCount).toBe(0);
    });
  });

  describe("detectDeadCode", () => {
    it("should detect unused exported functions", () => {
      const result = detectDeadCode(project, FIXTURE_PATH);

      const unusedFns = result.findings.filter(
        (f) => f.type === "unused-function"
      );
      const names = unusedFns.map((f) => f.symbolName);

      expect(names).toContain("unusedFunction");
      expect(names).toContain("anotherUnusedFunction");
    });

    it("should detect orphaned modules", () => {
      const result = detectDeadCode(project, FIXTURE_PATH);

      const orphaned = result.findings.filter(
        (f) => f.type === "orphaned-module"
      );
      const filePaths = orphaned.map((f) => f.filePath);

      // orphaned.ts and api.ts should be detected as orphaned
      expect(filePaths.some((p) => p.includes("orphaned.ts"))).toBe(true);
      expect(filePaths.some((p) => p.includes("api.ts"))).toBe(true);
    });

    it("should detect dead API handlers", () => {
      const result = detectDeadCode(project, FIXTURE_PATH);

      const deadApis = result.findings.filter((f) => f.type === "dead-api");
      const names = deadApis.map((f) => f.symbolName);

      expect(names).toContain("getUsers");
      expect(names).toContain("postUser");
      expect(names).toContain("deleteUser");
    });

    it("should detect unreachable internal code", () => {
      const result = detectDeadCode(project, FIXTURE_PATH);

      const unreachable = result.findings.filter(
        (f) => f.type === "unreachable-code"
      );
      const names = unreachable.map((f) => f.symbolName);

      expect(names).toContain("helperNeverCalled");
    });

    it("should have correct summary counts", () => {
      const result = detectDeadCode(project, FIXTURE_PATH);
      expect(result.summary.total).toBe(result.findings.length);
      expect(result.summary.total).toBeGreaterThan(0);
    });
  });
});
