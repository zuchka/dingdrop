import bcrypt from "bcryptjs";
import { createUser, getUserByEmail } from "~/models/user.server";

const MIN_PASSWORD_LENGTH = 8;

export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: string) {
  return password.length >= MIN_PASSWORD_LENGTH;
}

export async function register(email: string, password: string) {
  if (!validateEmail(email)) {
    throw new Error("Invalid email address.");
  }

  if (!validatePassword(password)) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    throw new Error("Email is already registered.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  return createUser({ email, passwordHash });
}

export async function login(email: string, password: string) {
  const user = await getUserByEmail(email);
  if (!user) {
    return null;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return null;
  }

  return user;
}
