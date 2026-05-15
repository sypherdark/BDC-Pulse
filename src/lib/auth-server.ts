import type { Role } from "@/lib/roles";

/**
 * Authentication is temporarily disabled — all routes run as admin.
 * Reinstate NextAuth here when sign-in should return.
 */

export type StubSession = {
  user: { id: string; email: string; role: Role };
  expires: string;
};

type SessionOk = { ok: true; session: StubSession; role: Role };

type SessionFail = { ok: false; response: Response };

export type GateResult = SessionOk | SessionFail;

function stubSession(): StubSession {
  return {
    user: { id: "0", email: "developer@bdc-pulse.local", role: "admin" },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export async function getOptionalSession(): Promise<StubSession> {
  return stubSession();
}

export async function requireSessionRole(): Promise<GateResult> {
  const session = stubSession();
  return {
    ok: true,
    session,
    role: session.user.role,
  };
}

export async function requireMutateRole(): Promise<GateResult> {
  const session = stubSession();
  return {
    ok: true,
    session,
    role: session.user.role,
  };
}
