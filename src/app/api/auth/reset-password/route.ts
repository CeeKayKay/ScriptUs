import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (!token || !password) {
    return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  // Find the token
  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!record) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }

  if (record.expires < new Date()) {
    // Clean up expired token
    await prisma.verificationToken.delete({ where: { token } });
    return NextResponse.json({ error: "This reset link has expired. Please request a new one." }, { status: 400 });
  }

  // Find the user by email (identifier)
  const user = await prisma.user.findUnique({
    where: { email: record.identifier },
  });

  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Hash new password and update
  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed },
  });

  // Delete the used token
  await prisma.verificationToken.delete({ where: { token } });

  return NextResponse.json({ success: true });
}
