import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseScriptText } from "@/lib/script-parser";

const WRITER_ROLES = ["STAGE_MANAGER", "DIRECTOR", "WRITER"];

// POST /api/projects/[id]/import — Import a script from text or PDF
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

  if (!membership.roles.some((r: string) => WRITER_ROLES.includes(r))) {
    return NextResponse.json(
      { error: "Only Stage Managers, Directors, and Writers can import scripts" },
      { status: 403 }
    );
  }

  try {
  // Parse multipart form data
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const rawText = formData.get("text") as string | null;
  const mode = formData.get("mode") as string | null; // "replace" or "append"

  let scriptText = "";

  if (file) {
    const arrayBuf = await file.arrayBuffer();

    if (file.name.toLowerCase().endsWith(".pdf")) {
      try {
        const { extractText } = await import("unpdf");
        const pdfData = await extractText(new Uint8Array(arrayBuf));
        scriptText = Array.isArray(pdfData.text) ? pdfData.text.join("\n") : String(pdfData.text);
      } catch (e: any) {
        console.error("PDF parse error:", e);
        return NextResponse.json({ error: `Failed to parse PDF: ${e.message || "Unknown error"}` }, { status: 400 });
      }
    } else {
      // Plain text / .txt / .fountain / etc.
      scriptText = Buffer.from(arrayBuf).toString("utf-8");
    }
  } else if (rawText) {
    scriptText = rawText;
  } else {
    return NextResponse.json({ error: "No file or text provided" }, { status: 400 });
  }

  if (!scriptText.trim()) {
    return NextResponse.json({ error: "Empty script content" }, { status: 400 });
  }

  // Parse the script
  const parsedScenes = parseScriptText(scriptText);

  if (parsedScenes.length === 0) {
    return NextResponse.json({ error: "No scenes could be parsed from the script" }, { status: 400 });
  }

  // If replacing, delete existing scenes first
  if (mode === "replace") {
    await prisma.scene.deleteMany({ where: { projectId } });
  }

  // Determine starting sort order
  let sortBase = 0;
  if (mode !== "replace") {
    const lastScene = await prisma.scene.findFirst({
      where: { projectId },
      orderBy: { sortOrder: "desc" },
    });
    sortBase = (lastScene?.sortOrder ?? -1) + 1;
  }

  // Track used act/scene combos (from DB + this import) to avoid unique constraint violations
  const usedSceneNums = new Map<number, Set<number>>(); // act -> set of scene numbers

  if (mode !== "replace") {
    // Load all existing scene numbers for this project
    const existingScenes = await prisma.scene.findMany({
      where: { projectId },
      select: { act: true, scene: true },
    });
    for (const es of existingScenes) {
      if (!usedSceneNums.has(es.act)) usedSceneNums.set(es.act, new Set());
      usedSceneNums.get(es.act)!.add(es.scene);
    }
  }

  // Batch create all scenes and lines
  const createdScenes = [];

  for (let i = 0; i < parsedScenes.length; i++) {
    const ps = parsedScenes[i];

    let act = ps.act;
    let sceneNum = ps.scene;

    // Ensure unique act/scene combo
    if (!usedSceneNums.has(act)) usedSceneNums.set(act, new Set());
    const actSet = usedSceneNums.get(act)!;
    while (actSet.has(sceneNum)) {
      sceneNum++;
    }
    actSet.add(sceneNum);

    const scene = await prisma.scene.create({
      data: {
        projectId,
        act,
        scene: sceneNum,
        title: ps.title,
        sortOrder: sortBase + i,
        scriptLines: {
          create: ps.lines.map((line, lineIdx) => ({
            type: line.type,
            character: line.character || null,
            text: line.text,
            sortOrder: lineIdx,
          })),
        },
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

    createdScenes.push({
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
    });
  }

  return NextResponse.json({
    scenes: createdScenes,
    summary: {
      scenesImported: createdScenes.length,
      totalLines: createdScenes.reduce((sum, s) => sum + s.lines.length, 0),
    },
  }, { status: 201 });

  } catch (err: any) {
    console.error("Import route error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error during import" },
      { status: 500 }
    );
  }
}
