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

// GET /api/projects/[id]/characters — List all character groups, characters, and ungrouped characters
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

  const [groups, ungrouped] = await Promise.all([
    prisma.characterGroup.findMany({
      where: { projectId },
      orderBy: { sortOrder: "asc" },
      include: {
        characters: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.character.findMany({
      where: { projectId, groupId: null },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return NextResponse.json({
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      sortOrder: g.sortOrder,
      characters: g.characters.map((c) => ({
        id: c.id,
        name: c.name,
        groupId: c.groupId,
        sortOrder: c.sortOrder,
      })),
    })),
    ungrouped: ungrouped.map((c) => ({
      id: c.id,
      name: c.name,
      groupId: null,
      sortOrder: c.sortOrder,
    })),
  });
}

// POST /api/projects/[id]/characters — Create a character or a group
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

  // Create a group
  if (body.type === "group") {
    if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
    try {
      const lastGroup = await prisma.characterGroup.findFirst({
        where: { projectId },
        orderBy: { sortOrder: "desc" },
      });
      const group = await prisma.characterGroup.create({
        data: {
          projectId,
          name: body.name.trim(),
          sortOrder: (lastGroup?.sortOrder ?? -1) + 1,
        },
        include: { characters: true },
      });
      return NextResponse.json({
        id: group.id,
        name: group.name,
        sortOrder: group.sortOrder,
        characters: [],
      }, { status: 201 });
    } catch (e: any) {
      if (e.code === "P2002") return NextResponse.json({ error: "Group name already exists" }, { status: 409 });
      throw e;
    }
  }

  // Create a character
  if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  try {
    const lastChar = await prisma.character.findFirst({
      where: { projectId, groupId: body.groupId || null },
      orderBy: { sortOrder: "desc" },
    });
    const character = await prisma.character.create({
      data: {
        projectId,
        groupId: body.groupId || null,
        name: body.name.trim().toUpperCase(),
        sortOrder: (lastChar?.sortOrder ?? -1) + 1,
      },
    });
    return NextResponse.json({
      id: character.id,
      name: character.name,
      groupId: character.groupId,
      sortOrder: character.sortOrder,
    }, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Character already exists" }, { status: 409 });
    throw e;
  }
}

// PATCH /api/projects/[id]/characters — Update a character or group
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

  // Update a group name
  if (body.groupId && body.name !== undefined) {
    const updated = await prisma.characterGroup.update({
      where: { id: body.groupId },
      data: { name: body.name.trim() },
    });
    return NextResponse.json({ id: updated.id, name: updated.name });
  }

  // Update a character (name or groupId)
  if (body.characterId) {
    const data: any = {};
    if (body.name !== undefined) data.name = body.name.trim().toUpperCase();
    if (body.groupId !== undefined) data.groupId = body.groupId || null;
    const updated = await prisma.character.update({
      where: { id: body.characterId },
      data,
    });
    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      groupId: updated.groupId,
      sortOrder: updated.sortOrder,
    });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

// DELETE /api/projects/[id]/characters — Delete a character or group
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
  const characterId = searchParams.get("characterId");
  const groupId = searchParams.get("groupId");

  if (characterId) {
    await prisma.character.delete({ where: { id: characterId } });
    return NextResponse.json({ success: true });
  }

  if (groupId) {
    // Ungroup characters first, then delete group
    await prisma.character.updateMany({
      where: { groupId },
      data: { groupId: null },
    });
    await prisma.characterGroup.delete({ where: { id: groupId } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Provide characterId or groupId" }, { status: 400 });
}
