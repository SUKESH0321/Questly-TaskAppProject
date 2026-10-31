import { User } from "../models/User.js";
import { env } from "./env.js";

/**
 * Makes sure the company admin account exists. It is created once and never overwritten,
 * so changing the password later (or via ADMIN_PASSWORD on a fresh database) is safe.
 * Log in with the username (not an email address).
 */
export async function ensureAdminAccount(): Promise<void> {
  const username = env.admin.username.toLowerCase();
  if (await User.exists({ email: username })) return;

  await User.create({
    name: "Questly Admin",
    email: username, // the login username; admins don't use a real email
    password: env.admin.password,
    role: "admin",
    phoneVerified: false,
  });
  console.log(`Admin account created (username: ${username}).`);
  if (env.isProduction && env.admin.isDefaultPassword) {
    console.warn("WARNING: the admin account uses the default password. Set ADMIN_PASSWORD before going live.");
  }
}
