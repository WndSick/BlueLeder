import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret-key-change-in-production";

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Signs a payload to generate a 24-hour access JWT token.
 * @param payload User identity information
 * @returns Signed JWT string
 */
export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

/**
 * Verifies and decodes a signed JWT token.
 * @param token Signed JWT string
 * @returns Decoded JWTPayload if valid, null otherwise
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded as JWTPayload;
  } catch (error) {
    return null;
  }
}
