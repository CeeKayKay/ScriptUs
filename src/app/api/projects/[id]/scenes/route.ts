import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/projects/[id]/scenes — Create a scene
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

  if (!membership.roles.some((r: string) => ["STAGE_MANAGER", "DIRECTOR", "WRITER"].includes(r))) {
    return NextResponse.json(
      { error: "Only Stage Managers, Directors, and Writers can add scenes" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { act, scene: sceneNum, title, position } = body;

  if (!act || !sceneNum || !title) {
    return NextResponse.json(
      { error: "Act, scene number, and title are required" },
      { status: 400 }
    );
  }

  let sortOrder: number;

  if (position === "start") {
    // Insert before all existing scenes — shift existing sortOrders up
    const firstScene = await prisma.scene.findFirst({
      where: { projectId },
      orderBy: { sortOrder: "asc" },
    });
    if (firstScene) {
      await prisma.scene.updateMany({
        where: { projectId },
        data: { sortOrder: { increment: 1 } },
      });
      sortOrder = firstScene.sortOrder;
    } else {
      sortOrder = 0;
    }
  } else {
    // Append after all existing scenes
    const lastScene = await prisma.scene.findFirst({
      where: { projectId },
      orderBy: { sortOrder: "desc" },
    });
    sortOrder = (lastScene?.sortOrder ?? -1) + 1;
  }

  try {
    const newScene = await prisma.scene.create({
      data: {
        projectId,
        act: Number(act),
        scene: Number(sceneNum),
        title: title.trim(),
        sortOrder,
      },
      include: {
        scriptLines: {
          orderBy: { sortOrder: "asc" },
          include: {
            cues: {
              orderBy: { number: "asc" },
              include: {
                createdBy: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    const sceneView = {
      id: newScene.id,
      act: newScene.act,
      scene: newScene.scene,
      title: newScene.title,
      lines: newScene.scriptLines.map((line) => ({
        id: line.id,
        sceneId: newScene.id,
        type: line.type,
        character: line.character,
        text: line.text,
        sortOrder: line.sortOrder,
        cues: line.cues.map((cue) => ({
          id: cue.id,
          type: cue.type,
          label: cue.label,
          number: cue.number,
          note: cue.note,
          status: cue.status,
          lineId: cue.lineId,
          sceneId: cue.sceneId,
          duration: cue.duration,
          preWait: cue.preWait,
          followTime: cue.followTime,
          createdBy: cue.createdBy,
          updatedAt: cue.updatedAt.toISOString(),
        })),
      })),
    };

    return NextResponse.json(sceneView, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json(
        { error: "A scene with that act/scene number already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create scene" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id]/scenes — Edit a scene title or a script line
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

  if (!membership.roles.some((r: string) => ["STAGE_MANAGER", "DIRECTOR", "WRITER"].includes(r))) {
    return NextResponse.json(
      { error: "Only Stage Managers, Directors, and Writers can edit script content" },
      { status: 403 }
    );
  }

  const body = await req.json();

  // Edit a scene title
  if (body.sceneId && body.title !== undefined) {
    const scene = await prisma.scene.findFirst({
      where: { id: body.sceneId, projectId },
    });
    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    const updated = await prisma.scene.update({
      where: { id: body.sceneId },
      data: { title: body.title.trim() },
    });

    return NextResponse.json({
      id: updated.id,
      act: updated.act,
      scene: updated.scene,
      title: updated.title,
    });
  }

  // Edit a script line
  if (body.lineId) {
    const line = await prisma.scriptLine.findUnique({
      where: { id: body.lineId },
      include: { scene: true },
    });

    if (!line || line.scene.projectId !== projectId) {
      return NextResponse.json({ error: "Line not found" }, { status: 404 });
    }

    const updated = await prisma.scriptLine.update({
      where: { id: body.lineId },
      data: {
        ...(body.text !== undefined && { text: body.text.trim() }),
        ...(body.character !== undefined && { character: body.character || null }),
        ...(body.type !== undefined && { type: body.type }),
      },
    });

    return NextResponse.json({
      id: updated.id,
      sceneId: updated.sceneId,
      type: updated.type,
      character: updated.character,
      text: updated.text,
      sortOrder: updated.sortOrder,
    });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

// DELETE /api/projects/[id]/scenes — Delete a scene or script line
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

  if (!membership.roles.some((r: string) => ["STAGE_MANAGER", "DIRECTOR", "WRITER"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const lineId = searchParams.get("lineId");
  const sceneId = searchParams.get("sceneId");

  if (lineId) {
    const line = await prisma.scriptLine.findUnique({
      where: { id: lineId },
      include: { scene: true },
    });
    if (!line || line.scene.projectId !== projectId) {
      return NextResponse.json({ error: "Line not found" }, { status: 404 });
    }
    await prisma.scriptLine.delete({ where: { id: lineId } });
    return NextResponse.json({ success: true });
  }

  if (sceneId) {
    const scene = await prisma.scene.findFirst({
      where: { id: sceneId, projectId },
    });
    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }
    await prisma.scene.delete({ where: { id: sceneId } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Provide lineId or sceneId" }, { status: 400 });
}

// PUT /api/projects/[id]/scenes — Add a script line to a scene
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

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // Writers: SM, Director, or anyone with write intent
  if (!membership.roles.some((r: string) => ["STAGE_MANAGER", "DIRECTOR", "WRITER"].includes(r))) {
    return NextResponse.json(
      { error: "Only Stage Managers, Directors, and Writers can edit script content" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { sceneId, type, character, text } = body;

  if (!sceneId || !type || !text) {
    return NextResponse.json(
      { error: "Scene ID, type, and text are required" },
      { status: 400 }
    );
  }

  // Verify the scene belongs to this project
  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, projectId },
  });

  if (!scene) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }

  // Get the next sort order for lines in this scene
  const lastLine = await prisma.scriptLine.findFirst({
    where: { sceneId },
    orderBy: { sortOrder: "desc" },
  });

  const line = await prisma.scriptLine.create({
    data: {
      sceneId,
      type,
      character: character || null,
      text: text.trim(),
      sortOrder: (lastLine?.sortOrder ?? -1) + 1,
    },
    include: {
      cues: {
        orderBy: { number: "asc" },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  const lineView = {
    id: line.id,
    sceneId,
    type: line.type,
    character: line.character,
    text: line.text,
    sortOrder: line.sortOrder,
    cues: line.cues.map((cue) => ({
      id: cue.id,
      type: cue.type,
      label: cue.label,
      number: cue.number,
      note: cue.note,
      status: cue.status,
      lineId: cue.lineId,
      sceneId: cue.sceneId,
      duration: cue.duration,
      preWait: cue.preWait,
      followTime: cue.followTime,
      createdBy: cue.createdBy,
      updatedAt: cue.updatedAt.toISOString(),
    })),
  };

  return NextResponse.json(lineView, { status: 201 });
}
