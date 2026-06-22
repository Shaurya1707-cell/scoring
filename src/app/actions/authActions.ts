"use server";

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db";
import { signJWT } from "@/lib/auth";

export async function loginAction(state: any, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Please enter both email and password." };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { error: "Invalid email or password." };
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return { error: "Invalid email or password." };
    }

    // Generate JWT
    const token = await signJWT({
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email,
    });

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 86400, // 1 day
      path: "/",
      sameSite: "lax",
    });

    return { success: true, role: user.role };
  } catch (err: any) {
    console.error("Login action error:", err);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("token");
}
