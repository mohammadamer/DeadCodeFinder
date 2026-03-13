import * as path from "node:path";
import * as fs from "node:fs";
import { Project } from "ts-morph";

interface ScanFilesResult {
  files: string[];
  entryPoints: string[];
  totalFiles: number;
}

/**
 * Scan all TS/JS files in the project and identify entry points.
 * Entry points are detected from package.json (main, bin, exports) and
 * common patterns (index.ts, main.ts, app.ts, server.ts).
 */
export function scanFiles(project: Project, targetPath: string): ScanFilesResult {
  const absolutePath = path.resolve(targetPath);
  const sourceFiles = project.getSourceFiles();

  const files = sourceFiles.map((sf) => sf.getFilePath());
  const entryPoints: string[] = [];

  // Check package.json for entry points
  const pkgJsonPath = path.join(absolutePath, "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));

      // main field
      if (pkg.main) {
        const resolved = resolveEntry(absolutePath, pkg.main);
        if (resolved) entryPoints.push(resolved);
      }

      // bin field
      if (pkg.bin) {
        const bins = typeof pkg.bin === "string" ? [pkg.bin] : Object.values(pkg.bin);
        for (const b of bins) {
          const resolved = resolveEntry(absolutePath, b as string);
          if (resolved) entryPoints.push(resolved);
        }
      }

      // exports field (simplified — handles string and object with "." key)
      if (pkg.exports) {
        const exps = typeof pkg.exports === "string"
          ? [pkg.exports]
          : typeof pkg.exports === "object" && pkg.exports["."]
            ? [typeof pkg.exports["."] === "string" ? pkg.exports["."] : pkg.exports["."].import || pkg.exports["."].require || pkg.exports["."].default].flat()
            : [];
        for (const e of exps) {
          if (typeof e === "string") {
            const resolved = resolveEntry(absolutePath, e);
            if (resolved) entryPoints.push(resolved);
          }
        }
      }
    } catch {
      // Ignore malformed package.json
    }
  }

  // Also check common entry point patterns
  const commonEntryPatterns = [
    "index.ts", "index.tsx", "index.js",
    "main.ts", "main.js",
    "app.ts", "app.js",
    "server.ts", "server.js",
    "src/index.ts", "src/index.tsx", "src/index.js",
    "src/main.ts", "src/main.js",
    "src/app.ts", "src/app.js",
  ];

  for (const pattern of commonEntryPatterns) {
    const candidate = path.resolve(absolutePath, pattern);
    const normalized = candidate.replace(/\\/g, "/");
    if (files.some((f) => f.replace(/\\/g, "/") === normalized) && !entryPoints.includes(normalized)) {
      entryPoints.push(normalized);
    }
  }

  return {
    files: files.map((f) => f.replace(/\\/g, "/")),
    entryPoints: [...new Set(entryPoints.map((e) => e.replace(/\\/g, "/")))],
    totalFiles: files.length,
  };
}

/** Resolve an entry point path, trying TS source variants */
function resolveEntry(basePath: string, entry: string): string | null {
  const candidates = [
    entry,
    entry.replace(/\.js$/, ".ts"),
    entry.replace(/\.js$/, ".tsx"),
  ];

  for (const c of candidates) {
    const full = path.resolve(basePath, c).replace(/\\/g, "/");
    if (fs.existsSync(full.replace(/\//g, path.sep))) {
      return full;
    }
  }
  return null;
}
