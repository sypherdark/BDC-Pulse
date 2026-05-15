/** Used only from middleware; keep env name aligned with NextAuth secret. */
export function getAuthSecret(): string | undefined {
  return process.env.NEXTAUTH_SECRET;
}
