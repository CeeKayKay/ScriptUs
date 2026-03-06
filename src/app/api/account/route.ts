import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/account — Delete the current user's account and all associated data
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;

  // Cascade delete handles most relations, but let's clean up projects
  // where the user is the sole member (delete the whole project)
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    include: {
      project: {
        include: { _count: { select: { members: true } } },
      },
    },
  });

  const soloProjects = memberships
    .filter((m) => m.project._count.members === 1)
    .map((m) => m.project.id);

  await prisma.$transaction([
    // Delete projects where user is the only member
    ...(soloProjects.length > 0
      ? [prisma.project.deleteMany({ where: { id: { in: soloProjects } } })]
      : []),
    // Delete the user (cascades memberships, comments, sessions, accounts)
    prisma.user.delete({ where: { id: userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
