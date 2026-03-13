import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/cues — Create a new cue
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const body = await req.json();

  // Verify membership in project
  const membership = await prisma.projectMember.findUnique({
    where: {
      userId_projectId: { userId, projectId: body.projectId },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // Only certain roles can create certain cue types
  const rolePermissions: Record<string, string[]> = {
    STAGE_MANAGER: ["LIGHT", "SOUND", "PROPS", "SET", "BLOCKING", "PROJECTION", "FLY", "SPOT"],
    DIRECTOR: ["BLOCKING"],
    ACTOR: ["BLOCKING"],
    LIGHTING: ["LIGHT", "PROJECTION", "SPOT"],
    SOUND: ["SOUND"],
    SET_DESIGN: ["SET", "FLY"],
    PROPS: ["PROPS"],
  };

  const allowed = new Set(membership.roles.flatMap((r: string) => rolePermissions[r] || []));

  // Check if cue type is allowed for built-in roles
  let isAllowed = allowed.has(body.type);

  // If not allowed by built-in roles, check if it's a custom cue type
  if (!isAllowed) {
    // Stage manager can create any cue type including custom ones
    if (membership.roles.includes("STAGE_MANAGER")) {
      isAllowed = true;
    } else {
      // Check if there's a custom cue type that matches
      const customCueType = await prisma.customCueType.findFirst({
        where: {
          projectId: body.projectId,
          type: body.type,
        },
      });

      if (customCueType) {
        // Custom cue type exists - allow it
        isAllowed = true;
      } else {
        // Also check if there's a custom role whose name matches the cue type pattern
        // This handles older custom roles that don't have a corresponding custom cue type
        const customRoles = await prisma.customRole.findMany({
          where: { projectId: body.projectId },
        });

        const matchingRole = customRoles.find(
          (role) => role.name.toUpperCase().replace(/\s+/g, "_") === body.type
        );

        if (matchingRole) {
          isAllowed = true;
        }
      }
    }
  }

  if (!isAllowed) {
    return NextResponse.json(
      { error: `Your roles cannot create ${body.type} cues` },
      { status: 403 }
    );
  }

  const cue = await prisma.cue.create({
    data: {
      projectId: body.projectId,
      sceneId: body.sceneId,
      lineId: body.lineId || null,
      type: body.type,
      label: body.label,
      number: body.number,
      note: body.note || "",
      scriptRef: body.scriptRef || null,
      status: "DRAFT",
      duration: body.duration || null,
      preWait: body.preWait || null,
      followTime: body.followTime || null,
      createdById: userId,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ cue }, { status: 201 });
}

// PATCH /api/cues — Update a cue
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const body = await req.json();

  if (!body.id) {
    return NextResponse.json({ error: "Cue ID required" }, { status: 400 });
  }

  const cue = await prisma.cue.findUnique({
    where: { id: body.id },
  });

  if (!cue) {
    return NextResponse.json({ error: "Cue not found" }, { status: 404 });
  }

  // Can't edit locked cues unless you're stage manager
  if (cue.status === "LOCKED") {
    const membership = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: { userId, projectId: cue.projectId },
      },
    });

    if (!membership?.roles.includes("STAGE_MANAGER")) {
      return NextResponse.json(
        { error: "Only stage manager can edit locked cues" },
        { status: 403 }
      );
    }
  }

  const updated = await prisma.cue.update({
    where: { id: body.id },
    data: {
      ...(body.label !== undefined && { label: body.label }),
      ...(body.number !== undefined && { number: body.number }),
      ...(body.note !== undefined && { note: body.note }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.duration !== undefined && { duration: body.duration }),
      ...(body.preWait !== undefined && { preWait: body.preWait }),
      ...(body.followTime !== undefined && { followTime: body.followTime }),
      ...(body.scriptRef !== undefined && { scriptRef: body.scriptRef || null }),
      ...(body.lineId !== undefined && { lineId: body.lineId }),
      updatedById: userId,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ cue: updated });
}

// DELETE /api/cues — Delete a cue
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const cueId = searchParams.get("id");

  if (!cueId) {
    return NextResponse.json({ error: "Cue ID required" }, { status: 400 });
  }

  const cue = await prisma.cue.findUnique({ where: { id: cueId } });
  if (!cue) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify membership
  const membership = await prisma.projectMember.findUnique({
    where: {
      userId_projectId: { userId, projectId: cue.projectId },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // Only stage manager or cue creator can delete
  if (!membership.roles.includes("STAGE_MANAGER") && cue.createdById !== userId) {
    return NextResponse.json(
      { error: "Only stage manager or creator can delete cues" },
      { status: 403 }
    );
  }

  await prisma.cue.delete({ where: { id: cueId } });

  return NextResponse.json({ deleted: true });
}
