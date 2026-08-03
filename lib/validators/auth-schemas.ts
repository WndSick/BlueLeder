import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  fullName: z.string().min(2, "Full name is required").trim(),
  role: z.enum(["ADMIN", "NGO", "COMMUNITY", "VERIFIER", "BUYER"]).default("NGO"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z.string().min(1, "Password is required"),
});
