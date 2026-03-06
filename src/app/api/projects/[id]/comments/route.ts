import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/projects/[id]/comments — List all comments for a project
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
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const comments = await prisma.comment.findMany({
    where: { projectId, lineId: { not: null } },
    include: {
      user: { select: { id: true, name: true, image: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      lineId: c.lineId,
      scriptRef: c.scriptRef,
      text: c.text,
      role: c.role,
      resolved: c.resolved,
      user: c.user,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

// POST /api/projects/[id]/comments — Create a comment on a script line
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
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.lineId || !body.text?.trim()) {
    return NextResponse.json({ error: "lineId and text are required" }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: {
      projectId,
      lineId: body.lineId,
      scriptRef: body.scriptRef || null,
      text: body.text.trim(),
      role: body.role || membership.roles[0],
      userId,
    },
    include: {
      user: { select: { id: true, name: true, image: true } },
    },
  });

  return NextResponse.json({
    id: comment.id,
    lineId: comment.lineId,
    scriptRef: comment.scriptRef,
    text: comment.text,
    role: comment.role,
    resolved: comment.resolved,
    user: comment.user,
    createdAt: comment.createdAt.toISOString(),
  }, { status: 201 });
}

// PATCH /api/projects/[id]/comments — Resolve/unresolve a comment
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
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.commentId) {
    return NextResponse.json({ error: "commentId required" }, { status: 400 });
  }

  const comment = await prisma.comment.update({
    where: { id: body.commentId },
    data: { resolved: body.resolved ?? true },
  });

  return NextResponse.json({ id: comment.id, resolved: comment.resolved });
}

// DELETE /api/projects/[id]/comments — Delete a comment
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
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const commentId = req.nextUrl.searchParams.get("commentId");
  if (!commentId) {
    return NextResponse.json({ error: "commentId required" }, { status: 400 });
  }

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.projectId !== projectId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only comment author or stage manager can delete
  if (comment.userId !== userId && !membership.roles.includes("STAGE_MANAGER")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await prisma.comment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
