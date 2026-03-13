// This file imports from utils but is never imported by anyone else.
// It's an orphaned module.
import { usedFunction } from "./utils.js";

export function orphanedHandler(): void {
  usedFunction();
}
