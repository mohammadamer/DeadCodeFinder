import { Project, ScriptTarget } from "ts-morph";
import * as path from "node:path";
import * as fs from "node:fs";

/**
 * Initialize a ts-morph Project from a target directory.
 * Respects tsconfig.json if present; otherwise creates a default config.
 */
export function createProject(targetPath: string): Project {
  const absolutePath = path.resolve(targetPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Target path does not exist: ${absolutePath}`);
  }

  const tsconfigPath = path.join(absolutePath, "tsconfig.json");

  if (fs.existsSync(tsconfigPath)) {
    return new Project({
      tsConfigFilePath: tsconfigPath,
      skipAddingFilesFromTsConfig: false,
    });
  }

  // No tsconfig — create project with default settings and add all TS/JS files
  const project = new Project({
    compilerOptions: {
      target: ScriptTarget.ES2022,
      allowJs: true,
      checkJs: false,
    },
  });

  project.addSourceFilesAtPaths(
    path.join(absolutePath, "**/*.{ts,tsx,js,jsx}")
  );

  return project;
}
