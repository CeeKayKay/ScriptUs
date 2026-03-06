import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendInviteEmail } from "@/lib/email";

const ADMIN_ROLES = ["STAGE_MANAGER", "DIRECTOR"];

// GET /api/projects/[id]/invites — List invites
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const { id: projectId } = await params;

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (!membership || !ADMIN_ROLES.includes(membership.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const invites = await prisma.invite.findMany({
    where: { projectId },
    include: { sentBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    invites: invites.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      sentBy: { name: inv.sentBy.name || "Unknown" },
      createdAt: inv.createdAt.toISOString(),
    })),
  });
}

// POST /api/projects/[id]/invites — Send invite
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const { id: projectId } = await params;

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (!membership || !ADMIN_ROLES.includes(membership.role)) {
    return NextResponse.json({ error: "Only Stage Manager or Director can invite" }, { status: 403 });
  }

  const body = await req.json();
  const email = body.email?.trim().toLowerCase();
  const role = body.role;

  if (!email || !role) {
    return NextResponse.json({ error: "email and role are required" }, { status: 400 });
  }

  // Check if already a member
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMember = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: existingUser.id, projectId } },
    });
    if (existingMember) {
      return NextResponse.json({ error: "User is already a member" }, { status: 400 });
    }
  }

  // Check for existing pending invite
  const existingInvite = await prisma.invite.findUnique({
    where: { projectId_email: { projectId, email } },
  });
  if (existingInvite && existingInvite.status === "PENDING") {
    return NextResponse.json({ error: "Invite already sent to this email" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { title: true },
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invite = await prisma.invite.upsert({
    where: { projectId_email: { projectId, email } },
    update: {
      role,
      status: "PENDING",
      expiresAt,
    },
    create: {
      projectId,
      email,
      role,
      sentById: userId,
      expiresAt,
    },
    include: { sentBy: { select: { name: true } } },
  });

  // Send email
  const baseUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin;
  const acceptUrl = `${baseUrl}/invite/${invite.token}`;

  try {
    await sendInviteEmail({
      to: email,
      projectTitle: project?.title || "Untitled",
      role,
      inviterName: session.user.name || "Someone",
      acceptUrl,
    });
  } catch (e) {
    console.error("Failed to send invite email:", e);
    // Don't fail the invite creation — the link still works
  }

  return NextResponse.json({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    status: invite.status,
    sentBy: { name: invite.sentBy.name || "Unknown" },
    createdAt: invite.createdAt.toISOString(),
  }, { status: 201 });
}

// DELETE /api/projects/[id]/invites — Revoke invite
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const { id: projectId } = await params;

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (!membership || !ADMIN_ROLES.includes(membership.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const inviteId = req.nextUrl.searchParams.get("inviteId");
  if (!inviteId) {
    return NextResponse.json({ error: "inviteId required" }, { status: 400 });
  }

  await prisma.invite.delete({ where: { id: inviteId } });
  return NextResponse.json({ ok: true });
}

// PATCH /api/projects/[id]/invites — Update member role
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const { id: projectId } = await params;

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (!membership || !ADMIN_ROLES.includes(membership.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  if (body.memberId && body.role) {
    await prisma.projectMember.update({
      where: { id: body.memberId },
      data: { role: body.role },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "memberId and role required" }, { status: 400 });
}
