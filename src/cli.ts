#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import * as path from "node:path";
import { formatMarkdown, formatJson, filterByConfidence } from "./report/formatter.js";
import { createCleanupPR } from "./github/pr.js";
import type { Confidence } from "./analysis/types.js";
import type { ScanResult } from "./agent/scanner.js";
import { scanForDeadCodeDirect } from "./agent/scanner.js";

/** Lazily load scan functions to avoid pulling in @github/copilot-sdk when not needed */
async function runScan(mode: "direct" | "agent", targetPath: string, model?: string): Promise<ScanResult> {
  if (mode === "direct") {
    return scanForDeadCodeDirect(targetPath);
  }
  // Lazily import agent client to avoid loading @github/copilot-sdk unless needed
  const { scanForDeadCode } = await import("./agent/client.js");
  return scanForDeadCode(targetPath, { model });
}

const program = new Command();

program
  .name("dead-code-finder")
  .description(
    "AI-powered dead code finder using GitHub Copilot SDK. " +
    "Identifies unused functions, orphaned modules, dead APIs, and unreachable code."
  )
  .version("1.0.0");

program
  .command("scan")
  .description("Scan a project directory for dead code")
  .argument("<path>", "Path to the project directory to scan")
  .option("-f, --format <format>", "Output format: markdown or json", "markdown")
  .option(
    "-c, --confidence <level>",
    "Minimum confidence threshold: high, medium, or all",
    "medium"
  )
  .option("--direct", "Use direct static analysis only (no Copilot SDK agent)", false)
  .option("-m, --model <model>", "LLM model to use with Copilot SDK", "gpt-4.1")
  .action(async (targetPath: string, options) => {
    const absolutePath = path.resolve(targetPath);
    const confidenceThreshold: Confidence =
      options.confidence === "all" ? "low" : (options.confidence as Confidence);

    console.log(chalk.blue("🔍 Dead Code Finder"));
    console.log(chalk.gray(`   Scanning: ${absolutePath}`));
    console.log(chalk.gray(`   Confidence: ${options.confidence}`));
    console.log(chalk.gray(`   Mode: ${options.direct ? "direct" : "agent"}`));
    console.log("");

    try {
      const startTime = Date.now();

      const result = await runScan(
        options.direct ? "direct" : "agent",
        absolutePath,
        options.model
      );

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      // Filter by confidence
      const filtered = filterByConfidence(result.findings, confidenceThreshold);

      // Format output
      const output =
        options.format === "json"
          ? formatJson(filtered, result.summary)
          : formatMarkdown(filtered, result.summary);

      console.log(output);
      console.log("");
      console.log(chalk.gray(`Completed in ${elapsed}s`));

      if (result.agentSummary && !options.direct) {
        console.log("");
        console.log(chalk.cyan("Agent notes: ") + result.agentSummary);
      }

      // Exit with code 1 if findings exist (useful for CI)
      if (filtered.length > 0) {
        process.exitCode = 1;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${message}`));
      process.exitCode = 2;
    }
  });

program
  .command("cleanup")
  .description("Scan for dead code and create a cleanup PR on GitHub")
  .argument("<path>", "Path to the project directory to scan")
  .requiredOption("-r, --repo <owner/repo>", "GitHub repository (e.g., octocat/hello-world)")
  .option("-b, --base <branch>", "Base branch for the PR", "main")
  .option(
    "-c, --confidence <level>",
    "Minimum confidence threshold: high, medium, or all",
    "medium"
  )
  .option("--dry-run", "Preview changes without creating a PR", false)
  .option("--direct", "Use direct static analysis only (no Copilot SDK agent)", false)
  .option("-m, --model <model>", "LLM model to use with Copilot SDK", "gpt-4.1")
  .action(async (targetPath: string, options) => {
    const absolutePath = path.resolve(targetPath);
    const confidenceThreshold: Confidence =
      options.confidence === "all" ? "low" : (options.confidence as Confidence);

    console.log(chalk.blue("🔍 Dead Code Finder — Cleanup Mode"));
    console.log(chalk.gray(`   Scanning: ${absolutePath}`));
    console.log(chalk.gray(`   Repository: ${options.repo}`));
    console.log(chalk.gray(`   Base branch: ${options.base}`));
    console.log(chalk.gray(`   Dry run: ${options.dryRun}`));
    console.log("");

    try {
      // Step 1: Scan
      console.log(chalk.yellow("Step 1/2: Scanning for dead code..."));

      const result = await runScan(
        options.direct ? "direct" : "agent",
        absolutePath,
        options.model
      );

      const filtered = filterByConfidence(result.findings, confidenceThreshold);

      if (filtered.length === 0) {
        console.log(chalk.green("✅ No dead code found. Your codebase is clean!"));
        return;
      }

      console.log(
        chalk.yellow(
          `   Found ${filtered.length} dead code issue(s). Creating cleanup PR...`
        )
      );

      // Step 2: Create PR
      console.log(chalk.yellow("Step 2/2: Creating cleanup PR..."));

      const prResult = await createCleanupPR({
        repoSlug: options.repo,
        baseBranch: options.base,
        findings: filtered,
        summary: result.summary,
        dryRun: options.dryRun,
      });

      if (prResult.dryRun) {
        console.log("");
        console.log(chalk.cyan("🏃 Dry run — no PR created"));
        console.log(chalk.gray(`   Branch would be: ${prResult.branchName}`));
        console.log(chalk.gray(`   Files affected: ${prResult.changes.length}`));
        for (const change of prResult.changes) {
          console.log(
            chalk.gray(`     ${change.action}: ${change.filePath} (${change.symbols.join(", ")})`)
          );
        }
      } else {
        console.log("");
        console.log(chalk.green(`✅ Cleanup PR created!`));
        console.log(chalk.green(`   ${prResult.prUrl}`));
        console.log(chalk.gray(`   PR #${prResult.prNumber} on branch ${prResult.branchName}`));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${message}`));
      process.exitCode = 2;
    }
  });

program.parse();
