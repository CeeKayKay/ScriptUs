import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/projects — List user's projects
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;

  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    include: {
      project: {
        include: {
          _count: {
            select: {
              scenes: true,
              cues: true,
              members: true,
            },
          },
        },
      },
    },
    orderBy: { project: { updatedAt: "desc" } },
  });

  const projects = memberships.map((m) => ({
    id: m.project.id,
    title: m.project.title,
    subtitle: m.project.subtitle,
    memberCount: m.project._count.members,
    cueCount: m.project._count.cues,
    sceneCount: m.project._count.scenes,
    updatedAt: m.project.updatedAt.toISOString(),
    myRole: m.role,
  }));

  return NextResponse.json({ projects });
}

// POST /api/projects — Create new project
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const body = await req.json();

  const project = await prisma.project.create({
    data: {
      title: body.title || "Untitled Production",
      subtitle: body.subtitle || null,
      description: body.description || null,
      members: {
        create: {
          userId,
          role: "STAGE_MANAGER", // Creator defaults to stage manager
        },
      },
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
