# Dead Code Finder

AI-powered dead code finder using **GitHub Copilot SDK**. Identifies unused functions, orphaned modules, dead APIs, and unreachable code in TypeScript/JavaScript projects — then suggests a cleanup PR.

## Features

- **Unused Functions** — Exported functions, classes, or variables never imported anywhere
- **Orphaned Modules** — Files never imported by any other file and not entry points
- **Dead APIs** — API route handlers, endpoint functions defined but never wired up
- **Unreachable Code** — Internal functions declared but never called
- **AI-Powered Analysis** — Uses GitHub Copilot SDK to reason about findings and filter false positives
- **Cleanup PRs** — Automatically creates GitHub PRs with findings and recommended removals
- **Confidence Scoring** — High/medium/low confidence levels for prioritized review

## Architecture

```
CLI/GitHub Action
       │
       ▼
┌─────────────────────┐
│  GitHub Copilot SDK  │  ← Agent orchestrates analysis
│  (CopilotClient)     │
└────────┬────────────┘
         │ custom tools
         ▼
┌─────────────────────┐
│   Static Analysis    │  ← ts-morph (TypeScript compiler API)
│   Engine             │
├──────────────────────┤
│ • scanFiles          │  List files, detect entry points
│ • analyzeExports     │  Extract exported symbols
│ • analyzeImports     │  Map import graph
│ • findUsages         │  Find all references
│ • detectDeadCode     │  Cross-reference → findings
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Report / PR         │  ← Markdown/JSON report + GitHub PR
└─────────────────────┘
```

## Installation

```bash
npm install -g dead-code-finder
```

Or use directly with npx:

```bash
npx dead-code-finder scan ./src
```

## Usage

### CLI — Scan for Dead Code

```bash
# Scan a project (uses Copilot SDK agent for intelligent analysis)
dead-code-finder scan ./my-project

# Scan with direct static analysis only (no Copilot SDK)
dead-code-finder scan ./my-project --direct

# Output as JSON
dead-code-finder scan ./my-project --format json

# Only show high-confidence findings
dead-code-finder scan ./my-project --confidence high

# Show all findings including low confidence
dead-code-finder scan ./my-project --confidence all
```

### CLI — Create Cleanup PR

```bash
# Scan and create a cleanup PR
dead-code-finder cleanup ./my-project --repo octocat/hello-world

# Dry run — preview what would be in the PR
dead-code-finder cleanup ./my-project --repo octocat/hello-world --dry-run

# Use a different base branch
dead-code-finder cleanup ./my-project --repo octocat/hello-world --base develop
```

**Required:** Set `GITHUB_TOKEN` environment variable for PR creation:
```bash
export GITHUB_TOKEN=ghp_your_token_here
```

### GitHub Action

```yaml
name: Dead Code Check
on:
  pull_request:
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Monday

jobs:
  dead-code:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: your-org/dead-code-finder@v1
        with:
          path: '.'
          confidence: 'medium'
          format: 'markdown'
          mode: 'direct'          # or 'agent' to use Copilot SDK
          create-pr: 'false'      # set to 'true' to auto-create PR
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

#### Action Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `path` | Path to scan (relative to repo root) | `.` |
| `confidence` | Min threshold: `high`, `medium`, or `all` | `medium` |
| `format` | Output format: `markdown` or `json` | `markdown` |
| `mode` | `agent` (Copilot SDK) or `direct` (static only) | `direct` |
| `create-pr` | Create a cleanup PR | `false` |
| `base-branch` | Base branch for the PR | `main` |
| `github-token` | GitHub token for PR creation | `${{ github.token }}` |

#### Action Outputs

| Output | Description |
|--------|-------------|
| `findings-count` | Total number of findings |
| `findings-json` | JSON string of all findings |
| `report` | Formatted report |
| `pr-url` | URL of cleanup PR (if created) |

## How It Works

### Two Modes

1. **Agent Mode** (default): Uses the GitHub Copilot SDK to orchestrate analysis. The AI agent:
   - Calls the static analysis tools
   - Reviews findings and applies judgment
   - Filters false positives (event handlers, dynamic imports, decorator-based registrations)
   - Assigns confidence levels

2. **Direct Mode** (`--direct`): Runs static analysis only, without the Copilot SDK. Faster but less nuanced — uses heuristics instead of AI reasoning.

### Detection Categories

| Category | What it finds | Example |
|----------|---------------|---------|
| **Unused Functions** | Exported symbols with zero external imports | `export function oldHelper() {}` never imported |
| **Orphaned Modules** | Files never imported and not entry points | `utils/legacy.ts` not imported anywhere |
| **Dead APIs** | API-like exports (get/post/handle prefixed) never used | `export function getOldEndpoint()` never wired |
| **Unreachable Code** | Internal functions never called | `function helper() {}` declared but never invoked |

### Confidence Levels

| Level | Meaning | Action |
|-------|---------|--------|
| 🔴 **High** | Clearly unused, safe to remove | Remove immediately |
| 🟡 **Medium** | Possibly used dynamically or externally | Review carefully |
| 🟢 **Low** | Uncertain, may have side effects | Investigate before removing |

## Programmatic API

```typescript
import { scanForDeadCodeDirect, formatMarkdown } from "dead-code-finder";

const result = await scanForDeadCodeDirect("./my-project");
const report = formatMarkdown(result.findings, result.summary);
console.log(report);
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Dev mode (run CLI without building)
npx ts-node src/cli.ts scan ./test/fixtures/sample-project --direct
```

## License

MIT

Everything is working. Here's the final status:

Build: Clean TypeScript compilation
E2E CLI: Successfully scans the sample project in direct mode, detecting 11 findings (4 unused functions, 2 orphaned modules, 3 dead APIs, 2 unreachable code)
Tests: All 20 tests pass across 2 test suites
The Dead Code Finder app is complete and fully functional with:

CLI (dead-code-finder scan <path>) with --direct mode (no SDK needed) and agent mode (uses GitHub Copilot SDK)
GitHub Action (configurable via action.yml)
5 analysis tools: scan files, analyze exports, analyze imports, find usages, detect dead code
Report output in Markdown or JSON format
Cleanup PR creation via GitHub Octokit