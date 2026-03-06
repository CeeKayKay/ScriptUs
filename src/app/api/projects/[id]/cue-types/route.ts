import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/projects/[id]/cue-types — Update a custom cue type
export async function PUT(
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

  if (!membership || !membership.roles.some((r: string) => ["STAGE_MANAGER", "DIRECTOR"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { id: cueTypeId, type, label, color, bgColor, borderColor, associatedRole } = body;

  if (!cueTypeId) {
    return NextResponse.json({ error: "Cue type ID is required" }, { status: 400 });
  }

  try {
    const cueType = await prisma.customCueType.update({
      where: { id: cueTypeId, projectId },
      data: {
        ...(type !== undefined && { type: type.trim().toUpperCase().replace(/\s+/g, "_") }),
        ...(label !== undefined && { label: label.trim() }),
        ...(color !== undefined && { color }),
        ...(bgColor !== undefined && { bgColor }),
        ...(borderColor !== undefined && { borderColor }),
        ...(associatedRole !== undefined && { associatedRole }),
      },
    });

    return NextResponse.json(cueType);
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json(
        { error: "A cue type with that key already exists" },
        { status: 409 }
      );
    }
    if (e.code === "P2025") {
      return NextResponse.json({ error: "Cue type not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update cue type" }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/cue-types — Delete a custom cue type
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

  if (!membership || !membership.roles.some((r: string) => ["STAGE_MANAGER", "DIRECTOR"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const cueTypeId = searchParams.get("cueTypeId");

  if (!cueTypeId) {
    return NextResponse.json({ error: "Cue type ID is required" }, { status: 400 });
  }

  try {
    await prisma.customCueType.delete({
      where: { id: cueTypeId, projectId },
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.code === "P2025") {
      return NextResponse.json({ error: "Cue type not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete cue type" }, { status: 500 });
  }
}

// POST /api/projects/[id]/cue-types — Create a custom cue type
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

  // Verify membership and admin role
  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  if (!membership.roles.some((r: string) => ["STAGE_MANAGER", "DIRECTOR"].includes(r))) {
    return NextResponse.json(
      { error: "Only Stage Managers and Directors can add cue types" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { type, label, color, bgColor, borderColor, associatedRole } = body;

  if (!type || !label) {
    return NextResponse.json(
      { error: "Type key and label are required" },
      { status: 400 }
    );
  }

  try {
    const cueType = await prisma.customCueType.create({
      data: {
        projectId,
        type: type.trim().toUpperCase().replace(/\s+/g, "_"),
        label: label.trim(),
        color: color || "#888888",
        bgColor: bgColor || "rgba(136, 136, 136, 0.08)",
        borderColor: borderColor || "rgba(136, 136, 136, 0.25)",
        associatedRole: associatedRole || "STAGE_MANAGER",
      },
    });

    return NextResponse.json(cueType, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json(
        { error: "A cue type with that key already exists in this project" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create cue type" },
      { status: 500 }
    );
  }
}
