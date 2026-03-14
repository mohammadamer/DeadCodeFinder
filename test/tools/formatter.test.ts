import { describe, it, expect } from "vitest";
import { formatMarkdown, formatJson, filterByConfidence } from "../../src/report/formatter.js";
import type { DeadCodeFinding, Confidence } from "../../src/analysis/types.js";

const sampleFindings: DeadCodeFinding[] = [
  {
    type: "unused-function",
    filePath: "/src/utils.ts",
    symbolName: "unusedFunction",
    line: 7,
    confidence: "high",
    reason: "Exported function 'unusedFunction' is never imported.",
  },
  {
    type: "orphaned-module",
    filePath: "/src/orphaned.ts",
    symbolName: "orphaned.ts",
    line: 1,
    confidence: "high",
    reason: "File is never imported by any other module.",
  },
  {
    type: "dead-api",
    filePath: "/src/api.ts",
    symbolName: "getUsers",
    line: 3,
    confidence: "medium",
    reason: "API handler 'getUsers' is never imported.",
  },
  {
    type: "unreachable-code",
    filePath: "/src/utils.ts",
    symbolName: "helperNeverCalled",
    line: 16,
    confidence: "high",
    reason: "Internal function is never called.",
  },
];

const sampleSummary = {
  unusedFunctions: 1,
  orphanedModules: 1,
  deadApis: 1,
  unreachableCode: 1,
  total: 4,
};

describe("Report Formatter", () => {
  describe("formatMarkdown", () => {
    it("should produce valid markdown with all sections", () => {
      const md = formatMarkdown(sampleFindings, sampleSummary);
      expect(md).toContain("# Dead Code Report");
      expect(md).toContain("## Summary");
      expect(md).toContain("Unused Functions");
      expect(md).toContain("Orphaned Modules");
      expect(md).toContain("Dead APIs");
      expect(md).toContain("Unreachable Code");
      expect(md).toContain("unusedFunction");
      expect(md).toContain("getUsers");
      expect(md).toContain("helperNeverCalled");
    });

    it("should show clean message for zero findings", () => {
      const md = formatMarkdown([], { ...sampleSummary, total: 0 });
      expect(md).toContain("No dead code found");
    });
  });

  describe("formatJson", () => {
    it("should produce valid JSON", () => {
      const json = formatJson(sampleFindings, sampleSummary);
      const parsed = JSON.parse(json);
      expect(parsed.findings).toHaveLength(4);
      expect(parsed.summary.total).toBe(4);
    });
  });

  describe("filterByConfidence", () => {
    it("should filter to high-confidence only", () => {
      const filtered = filterByConfidence(sampleFindings, "high");
      expect(filtered).toHaveLength(3);
      expect(filtered.every((f) => f.confidence === "high")).toBe(true);
    });

    it("should include medium and high when threshold is medium", () => {
      const filtered = filterByConfidence(sampleFindings, "medium");
      expect(filtered).toHaveLength(4);
    });

    it("should include all when threshold is low", () => {
      const filtered = filterByConfidence(sampleFindings, "low");
      expect(filtered).toHaveLength(4);
    });
  });
});
