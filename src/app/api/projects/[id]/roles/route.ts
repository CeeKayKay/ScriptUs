import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/projects/[id]/roles — Update a custom role
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

  if (!membership || !["STAGE_MANAGER", "DIRECTOR"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { id: roleId, name, icon, color, visibleCueTypes } = body;

  if (!roleId) {
    return NextResponse.json({ error: "Role ID is required" }, { status: 400 });
  }

  try {
    const role = await prisma.customRole.update({
      where: { id: roleId, projectId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
        ...(visibleCueTypes !== undefined && { visibleCueTypes }),
      },
    });

    return NextResponse.json(role);
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json(
        { error: "A role with that name already exists" },
        { status: 409 }
      );
    }
    if (e.code === "P2025") {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/roles — Delete a custom role
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

  if (!membership || !["STAGE_MANAGER", "DIRECTOR"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const roleId = searchParams.get("roleId");

  if (!roleId) {
    return NextResponse.json({ error: "Role ID is required" }, { status: 400 });
  }

  try {
    await prisma.customRole.delete({
      where: { id: roleId, projectId },
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.code === "P2025") {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete role" }, { status: 500 });
  }
}

// POST /api/projects/[id]/roles — Create a custom role
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

  if (!["STAGE_MANAGER", "DIRECTOR"].includes(membership.role)) {
    return NextResponse.json(
      { error: "Only Stage Managers and Directors can add roles" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { name, icon, color, visibleCueTypes } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json(
      { error: "Role name is required" },
      { status: 400 }
    );
  }

  try {
    const role = await prisma.customRole.create({
      data: {
        projectId,
        name: name.trim(),
        icon: icon || "●",
        color: color || "#888888",
        visibleCueTypes: visibleCueTypes || [],
      },
    });

    return NextResponse.json(role, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json(
        { error: "A role with that name already exists in this project" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create role" },
      { status: 500 }
    );
  }
}
