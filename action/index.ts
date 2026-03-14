import * as path from "node:path";
import { scanForDeadCodeDirect } from "../src/agent/scanner.js";
import type { ScanResult } from "../src/agent/scanner.js";
import { formatMarkdown, formatJson, filterByConfidence } from "../src/report/formatter.js";
import { createCleanupPR } from "../src/github/pr.js";
import type { Confidence } from "../src/analysis/types.js";

// Simple GitHub Actions core helpers (avoids dependency on @actions/core)
function getInput(name: string): string {
  return process.env[`INPUT_${name.replace(/-/g, "_").toUpperCase()}`] || "";
}

function setOutput(name: string, value: string): void {
  const delimiter = `ghadelimiter_${Date.now()}`;
  const cmd = `${name}<<${delimiter}\n${value}\n${delimiter}`;
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    const fs = require("node:fs");
    fs.appendFileSync(outputFile, cmd + "\n");
  }
}

function summary(markdown: string): void {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    const fs = require("node:fs");
    fs.appendFileSync(summaryFile, markdown + "\n");
  }
}

function setFailed(message: string): void {
  console.error(`::error::${message}`);
  process.exitCode = 1;
}

async function run() {
  try {
    const targetPath = path.resolve(getInput("path") || ".");
    const confidenceInput = getInput("confidence") || "medium";
    const createPr = getInput("create-pr") === "true";
    const baseBranch = getInput("base-branch") || "main";
    const format = getInput("format") || "markdown";
    const mode = getInput("mode") || "direct";

    const confidenceThreshold: Confidence =
      confidenceInput === "all" ? "low" : (confidenceInput as Confidence);

    console.log(`🔍 Dead Code Finder`);
    console.log(`   Path: ${targetPath}`);
    console.log(`   Confidence: ${confidenceInput}`);
    console.log(`   Mode: ${mode}`);
    console.log(`   Create PR: ${createPr}`);

    // Run scan
    let result: ScanResult;
    if (mode === "direct") {
      result = await scanForDeadCodeDirect(targetPath);
    } else {
      const { scanForDeadCode } = await import("../src/agent/client.js");
      result = await scanForDeadCode(targetPath);
    }

    const filtered = filterByConfidence(result.findings, confidenceThreshold);

    // Format report
    const report =
      format === "json"
        ? formatJson(filtered, result.summary)
        : formatMarkdown(filtered, result.summary);

    // Set outputs
    setOutput("findings-count", String(filtered.length));
    setOutput("findings-json", JSON.stringify(filtered));
    setOutput("report", report);

    // Write step summary
    const markdownReport = formatMarkdown(filtered, result.summary);
    summary(markdownReport);

    console.log(report);

    // Create PR if requested
    if (createPr && filtered.length > 0) {
      const repo = process.env.GITHUB_REPOSITORY;
      if (!repo) {
        setFailed("GITHUB_REPOSITORY not set. Cannot create PR.");
        return;
      }

      // Set GITHUB_TOKEN for auth
      const token = getInput("github-token");
      if (token) {
        process.env.GITHUB_TOKEN = token;
      }

      const prResult = await createCleanupPR({
        repoSlug: repo,
        baseBranch,
        findings: filtered,
        summary: result.summary,
      });

      if (prResult.prUrl) {
        setOutput("pr-url", prResult.prUrl);
        console.log(`✅ Cleanup PR created: ${prResult.prUrl}`);
      }
    }

    // Fail the step if findings exist
    if (filtered.length > 0) {
      console.log(`::warning::Found ${filtered.length} dead code issue(s).`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    setFailed(message);
  }
}

run();
