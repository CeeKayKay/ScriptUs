import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["STAGE_MANAGER", "DIRECTOR"];

// GET /api/projects/[id]/settings — Get project settings (SMTP etc)
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

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (!membership || !membership.roles.some((r: string) => ADMIN_ROLES.includes(r))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { smtpUser: true, smtpPass: true, cueTypeColors: true, cueTypeColorsLight: true, cueNumberingSettings: true },
  });

  return NextResponse.json({
    smtpUser: project?.smtpUser || "",
    smtpConfigured: !!project?.smtpPass,
    cueTypeColors: project?.cueTypeColors || {},
    cueTypeColorsLight: project?.cueTypeColorsLight || {},
    cueNumberingSettings: project?.cueNumberingSettings || {},
  });
}

// PATCH /api/projects/[id]/settings — Update project settings
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
  if (!membership || !membership.roles.some((r: string) => ADMIN_ROLES.includes(r))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();

  const data: Record<string, any> = {};
  if (body.smtpUser !== undefined) data.smtpUser = body.smtpUser || null;
  if (body.smtpPass !== undefined) data.smtpPass = body.smtpPass || null;
  if (body.cueTypeColors !== undefined) data.cueTypeColors = body.cueTypeColors;
  if (body.cueTypeColorsLight !== undefined) data.cueTypeColorsLight = body.cueTypeColorsLight;
  if (body.cueNumberingSettings !== undefined) data.cueNumberingSettings = body.cueNumberingSettings;

  await prisma.project.update({
    where: { id: projectId },
    data,
  });

  return NextResponse.json({ ok: true });
}
