export type Role = "admin" | "consultant" | "viewer";

export function canMutate(role: Role | undefined) {
  return role === "admin" || role === "consultant";
}

export function isAdmin(role: Role | undefined) {
  return role === "admin";
}
