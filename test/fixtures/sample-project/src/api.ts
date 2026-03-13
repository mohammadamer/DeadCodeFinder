// API-like functions that are exported but never imported

export function getUsers(): string[] {
  return ["alice", "bob"];
}

export function postUser(name: string): void {
  console.log(`Creating user: ${name}`);
}

export function deleteUser(id: number): boolean {
  return true;
}
