import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

/** HS256 only — never let a token's own header choose the algorithm. */
const ALGORITHM = "HS256" as const;

export const COOKIE_NAME = "auth_token";

export interface JwtPayload {
  userId: number;
  email: string;
  name: string;
  role: "admin" | "user";
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d", algorithm: ALGORITHM });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: [ALGORITHM] }) as JwtPayload;
  } catch {
    return null;
  }
}

export function getAuthCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  };
}
