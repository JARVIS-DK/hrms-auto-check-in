import { NextResponse } from "next/server";
import { getAuthUser, type JwtPayload } from "../auth";

/**
 * Carries its own status code so routes don't have to string-match on
 * `error.message` — a genuine 500 whose text happened to contain "Forbidden"
 * used to be reported as a 403.
 */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireAdmin(): Promise<JwtPayload> {
  const user = await getAuthUser();
  if (!user) throw new AuthError("Unauthorized", 401);
  if (user.role !== "admin") throw new AuthError("Forbidden: Admin access required", 403);
  return user;
}

/**
 * One error shape for every admin route. `emptyBody` lets a list endpoint keep
 * returning the shape its client expects instead of a bare `{error}`.
 */
export function handleAdminError(
  route: string,
  err: unknown,
  emptyBody: Record<string, unknown> = {}
): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message, ...emptyBody }, { status: err.status });
  }
  console.error(`[API ${route}]`, err);
  return NextResponse.json(
    { error: "Internal server error", ...emptyBody },
    { status: 500 }
  );
}
