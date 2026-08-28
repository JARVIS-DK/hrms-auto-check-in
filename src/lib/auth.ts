import { cookies } from "next/headers";
import { COOKIE_NAME, verifyToken } from "./jwt";

// Token primitives live in ./jwt so proxy.ts can verify without importing
// next/headers, which is not available in that context.
export { signToken, verifyToken, getAuthCookie, COOKIE_NAME } from "./jwt";
export type { JwtPayload } from "./jwt";

export async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}
