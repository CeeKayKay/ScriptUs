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

  const body = await req.json();
  const updates: { id: string; number: number }[] = body.cues;

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "No cues provided" }, { status: 400 });
  }

  // Fetch current cues to update labels
  const cueIds = updates.map((u) => u.id);
  const cues = await prisma.cue.findMany({ where: { id: { in: cueIds } } });

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
