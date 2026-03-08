import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/projects/[id] — Full project data for the editor
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

  // Verify membership
  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      },
      scenes: {
        orderBy: { sortOrder: "asc" },
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
              comments: {
                orderBy: { createdAt: "asc" },
                include: {
                  user: { select: { id: true, name: true, image: true } },
                },
              },
            },
          },
        },
      },
      customRoles: {
        orderBy: { createdAt: "asc" },
      },
      customCueTypes: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Transform to view model
  const data = {
    id: project.id,
    title: project.title,
    subtitle: project.subtitle,
    myRoles: membership.roles,
    members: project.members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name || "Unknown",
      email: m.user.email || "",
      roles: m.roles,
      character: m.character,
      image: m.user.image,
    })),
    customRoles: project.customRoles.map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      color: r.color,
      visibleCueTypes: r.visibleCueTypes,
    })),
    cueTypeColors: project.cueTypeColors as Record<string, string> | null,
    cueTypeColorsLight: project.cueTypeColorsLight as Record<string, string> | null,
    customCueTypes: project.customCueTypes.map((ct) => ({
      id: ct.id,
      type: ct.type,
      label: ct.label,
      color: ct.color,
      bgColor: ct.bgColor,
      borderColor: ct.borderColor,
      associatedRole: ct.associatedRole,
    })),
    scenes: project.scenes.map((scene) => ({
      id: scene.id,
      act: scene.act,
      scene: scene.scene,
      title: scene.title,
      lines: scene.scriptLines.map((line) => ({
        id: line.id,
        sceneId: scene.id,
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
          scriptRef: cue.scriptRef,
          status: cue.status,
          lineId: cue.lineId,
          sceneId: cue.sceneId,
          duration: cue.duration,
          preWait: cue.preWait,
          followTime: cue.followTime,
          createdBy: cue.createdBy,
          updatedAt: cue.updatedAt.toISOString(),
        })),
        comments: line.comments.map((c) => ({
          id: c.id,
          lineId: c.lineId,
          scriptRef: c.scriptRef,
          text: c.text,
          role: c.role,
          resolved: c.resolved,
          user: c.user,
          createdAt: c.createdAt.toISOString(),
        })),
      })),
    })),
  };

  return NextResponse.json(data);
}
