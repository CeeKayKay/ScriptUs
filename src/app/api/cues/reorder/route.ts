import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/cues/reorder — Bulk update cue numbers after drag reorder
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const body = await req.json();
  const updates: { id: string; number: number }[] = body.cues;

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "No cues provided" }, { status: 400 });
  }

  // Fetch current cues and verify they all belong to the same project
  const cueIds = updates.map((u) => u.id);
  const cues = await prisma.cue.findMany({ where: { id: { in: cueIds } } });

  if (cues.length === 0) {
    return NextResponse.json({ error: "No cues found" }, { status: 404 });
  }

  // Verify all cues belong to the same project
  const projectIds = new Set(cues.map((c) => c.projectId));
  if (projectIds.size !== 1) {
    return NextResponse.json({ error: "Cues must belong to the same project" }, { status: 400 });
  }

  const projectId = cues[0].projectId;

  // Verify user is a member of this project
  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  await Promise.all(
    updates.map(({ id, number }) => {
      const cue = cues.find((c) => c.id === id);
      const newLabel = cue ? cue.label.replace(/Q[\d.]+/, `Q${number}`) : undefined;
      return prisma.cue.update({
        where: { id },
        data: {
          number,
          ...(newLabel && { label: newLabel }),
        },
      });
    })
  );

  return NextResponse.json({ success: true });
}
