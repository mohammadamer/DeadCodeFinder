// This function IS used — imported by consumer.ts
export function usedFunction(): string {
  return "I am used!";
}

// This function is NOT used anywhere
export function unusedFunction(): string {
  return "Nobody calls me";
}

// This function is also NOT used
export function anotherUnusedFunction(x: number): number {
  return x * 2;
}

// Internal function — not exported, not called
function helperNeverCalled(): void {
  console.log("I'm dead");
}

// Internal function — not exported, but called by usedFunction (not really, just for test)
function internalUsed(): boolean {
  return true;
}
