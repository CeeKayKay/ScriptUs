import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  // Always return success to prevent email enumeration
  if (!user || !user.password) {
    return NextResponse.json({ success: true });
  }

  // Generate a secure random token
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Delete any existing reset tokens for this email
  await prisma.verificationToken.deleteMany({
    where: { identifier: email.trim().toLowerCase() },
  });

  // Store the token
  await prisma.verificationToken.create({
    data: {
      identifier: email.trim().toLowerCase(),
      token,
      expires,
    },
  });

  // Find SMTP credentials from a project the user belongs to (prefer one with SMTP configured)
  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    include: { project: { select: { smtpUser: true, smtpPass: true } } },
  });
  const withSmtp = memberships.find((m) => m.project.smtpUser && m.project.smtpPass);
  const membership = withSmtp || memberships[0];

  const smtpUser = membership?.project?.smtpUser || undefined;
  const smtpPass = membership?.project?.smtpPass || undefined;

  // Send the reset email
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password/${token}`;

  try {
    await sendPasswordResetEmail({
      to: email.trim(),
      resetUrl,
      userName: user.name || "there",
      smtpUser: smtpUser || undefined,
      smtpPass: smtpPass || undefined,
    });
  } catch {
    // Don't expose email sending failures
  }

  return NextResponse.json({ success: true });
}
