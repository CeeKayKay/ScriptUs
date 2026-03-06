import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/invites/[token] — Get invite details (public, for showing the accept page)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: {
      project: { select: { title: true } },
      sentBy: { select: { name: true } },
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  if (invite.status !== "PENDING") {
    return NextResponse.json({ error: "Invitation has already been used" }, { status: 400 });
  }

  if (invite.expiresAt < new Date()) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    return NextResponse.json({ error: "Invitation has expired" }, { status: 400 });
  }

  return NextResponse.json({
    projectTitle: invite.project.title,
    role: invite.role,
    inviterName: invite.sentBy.name || "Someone",
  });
}

// POST /api/invites/[token] — Accept invite (requires auth)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Must be signed in" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const { token } = await params;

  const invite = await prisma.invite.findUnique({
    where: { token },
  });

  if (!invite || invite.status !== "PENDING") {
    return NextResponse.json({ error: "Invalid or used invitation" }, { status: 400 });
  }

  if (invite.expiresAt < new Date()) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    return NextResponse.json({ error: "Invitation has expired" }, { status: 400 });
  }

  // Check if already a member
  const existing = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId: invite.projectId } },
  });

  if (existing) {
    // Already a member, just mark invite as accepted
    await prisma.invite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" },
    });
    return NextResponse.json({ projectId: invite.projectId });
  }

  // Add as member and mark invite accepted
  await prisma.$transaction([
    prisma.projectMember.create({
      data: {
        userId,
        projectId: invite.projectId,
        roles: [invite.role],
      },
    }),
    prisma.invite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" },
    }),
  ]);

  return NextResponse.json({ projectId: invite.projectId });
}
