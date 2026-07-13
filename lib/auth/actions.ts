"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type LoginState = { status: "idle" | "error"; error?: string };

export async function loginAdmin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const rateLimit = await checkRateLimit("admin_login", { limit: 10, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.ok) {
    return { status: "error", error: "Too many login attempts. Please try again later." };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", error: "Please enter a valid email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { status: "error", error: "Invalid email or password." };
  }

  redirect("/admin");
}

export async function logoutAdmin() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
