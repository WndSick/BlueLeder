import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

/**
 * Hashes a plain text password using bcrypt.
 * @param password Plain text password
 * @returns Hashed password string
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares a plain text password with a bcrypt hash.
 * @param password Plain text password
 * @param hash Bcrypt password hash
 * @returns True if they match, false otherwise
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
