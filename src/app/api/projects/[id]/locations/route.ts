import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const WRITER_ROLES = ["STAGE_MANAGER", "DIRECTOR", "WRITER"];

async function getMembership(userId: string, projectId: string) {
  return prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
}

// GET /api/projects/[id]/locations
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const userId = (session.user as any).id;
  const membership = await getMembership(userId, projectId);
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const locations = await prisma.location.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(
    locations.map((l) => ({ id: l.id, name: l.name, sortOrder: l.sortOrder }))
  );
}

// POST /api/projects/[id]/locations
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const userId = (session.user as any).id;
  const membership = await getMembership(userId, projectId);
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });
  if (!membership.roles.some((r: string) => WRITER_ROLES.includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  try {
    const last = await prisma.location.findFirst({
      where: { projectId },
      orderBy: { sortOrder: "desc" },
    });
    const location = await prisma.location.create({
      data: {
        projectId,
        name: body.name.trim(),
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    return NextResponse.json({ id: location.id, name: location.name, sortOrder: location.sortOrder }, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Location already exists" }, { status: 409 });
    throw e;
  }
}

// PATCH /api/projects/[id]/locations
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const userId = (session.user as any).id;
  const membership = await getMembership(userId, projectId);
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });
  if (!membership.roles.some((r: string) => WRITER_ROLES.includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.id || !body.name?.trim()) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const updated = await prisma.location.update({
    where: { id: body.id },
    data: { name: body.name.trim() },
  });
  return NextResponse.json({ id: updated.id, name: updated.name, sortOrder: updated.sortOrder });
}

// DELETE /api/projects/[id]/locations
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const userId = (session.user as any).id;
  const membership = await getMembership(userId, projectId);
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });
  if (!membership.roles.some((r: string) => WRITER_ROLES.includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Provide id" }, { status: 400 });

  await prisma.location.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
