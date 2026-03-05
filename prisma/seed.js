// ============================================
// SCRIPTUS — Seed Script
// ============================================
// Run: npx prisma db seed
// Or:  node prisma/seed.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🎭 Seeding ScriptUs database...\n");

  // Create demo users
  const stageManager = await prisma.user.upsert({
    where: { email: "sm@scriptus.dev" },
    update: {},
    create: {
      email: "sm@scriptus.dev",
      name: "Kit Ramirez",
    },
  });

  const lightingDesigner = await prisma.user.upsert({
    where: { email: "ld@scriptus.dev" },
    update: {},
    create: {
      email: "ld@scriptus.dev",
      name: "Jordan Mitchell",
    },
  });

  const soundDesigner = await prisma.user.upsert({
    where: { email: "sd@scriptus.dev" },
    update: {},
    create: {
      email: "sd@scriptus.dev",
      name: "Alex Lee",
    },
  });

  const actor1 = await prisma.user.upsert({
    where: { email: "actor1@scriptus.dev" },
    update: {},
    create: {
      email: "actor1@scriptus.dev",
      name: "Samira Okafor",
    },
  });

  const actor2 = await prisma.user.upsert({
    where: { email: "actor2@scriptus.dev" },
    update: {},
    create: {
      email: "actor2@scriptus.dev",
      name: "David Chen",
    },
  });

  console.log("  ✓ Users created");

  // Create project
  const project = await prisma.project.create({
    data: {
      title: "The Evening Hour",
      subtitle: "A Play in Two Acts",
      description:
        "A story of reunion, secrets, and the spaces between what we say and what we mean.",
    },
  });

  console.log("  ✓ Project created");

  // Assign roles
  await prisma.projectMember.createMany({
    data: [
      { userId: stageManager.id, projectId: project.id, role: "STAGE_MANAGER" },
      { userId: lightingDesigner.id, projectId: project.id, role: "LIGHTING" },
      { userId: soundDesigner.id, projectId: project.id, role: "SOUND" },
      { userId: actor1.id, projectId: project.id, role: "ACTOR", character: "Margaret" },
      { userId: actor2.id, projectId: project.id, role: "ACTOR", character: "Thomas" },
    ],
  });

  console.log("  ✓ Roles assigned");

  // Create scenes
  const scene1 = await prisma.scene.create({
    data: {
      projectId: project.id,
      act: 1,
      scene: 1,
      title: "The Drawing Room, Evening",
      sortOrder: 1,
    },
  });

  const scene2 = await prisma.scene.create({
    data: {
      projectId: project.id,
      act: 1,
      scene: 2,
      title: "The Garden, Next Morning",
      sortOrder: 2,
    },
  });

  console.log("  ✓ Scenes created");

  // Create script lines for Scene 1
  const s1Lines = await Promise.all([
    prisma.scriptLine.create({
      data: {
        sceneId: scene1.id,
        type: "STAGE_DIRECTION",
        text: "Lights rise on a Victorian drawing room. A fire crackles in the hearth. MARGARET stands at the window, looking out. A clock on the mantle reads 8:15.",
        sortOrder: 1,
      },
    }),
    prisma.scriptLine.create({
      data: {
        sceneId: scene1.id,
        type: "DIALOGUE",
        character: "MARGARET",
        text: "He said he'd come by eight. Eight o'clock, he said. Not a minute later.",
        sortOrder: 2,
      },
    }),
    prisma.scriptLine.create({
      data: {
        sceneId: scene1.id,
        type: "DIALOGUE",
        character: "MARGARET",
        text: "(She turns from the window, clutching her shawl) Perhaps the roads. Perhaps the weather. Perhaps—",
        sortOrder: 3,
      },
    }),
    prisma.scriptLine.create({
      data: {
        sceneId: scene1.id,
        type: "STAGE_DIRECTION",
        text: "A sharp knock at the door. Margaret freezes.",
        sortOrder: 4,
      },
    }),
    prisma.scriptLine.create({
      data: {
        sceneId: scene1.id,
        type: "DIALOGUE",
        character: "MARGARET",
        text: "Come in.",
        sortOrder: 5,
      },
    }),
    prisma.scriptLine.create({
      data: {
        sceneId: scene1.id,
        type: "STAGE_DIRECTION",
        text: "The door opens. THOMAS enters, rain-soaked, carrying a battered suitcase. He sets it down slowly.",
        sortOrder: 6,
      },
    }),
    prisma.scriptLine.create({
      data: {
        sceneId: scene1.id,
        type: "DIALOGUE",
        character: "THOMAS",
        text: "Margaret.",
        sortOrder: 7,
      },
    }),
    prisma.scriptLine.create({
      data: {
        sceneId: scene1.id,
        type: "DIALOGUE",
        character: "MARGARET",
        text: "You're late.",
        sortOrder: 8,
      },
    }),
    prisma.scriptLine.create({
      data: {
        sceneId: scene1.id,
        type: "DIALOGUE",
        character: "THOMAS",
        text: "I know.",
        sortOrder: 9,
      },
    }),
    prisma.scriptLine.create({
      data: {
        sceneId: scene1.id,
        type: "DIALOGUE",
        character: "MARGARET",
        text: "(a beat) You're wet.",
        sortOrder: 10,
      },
    }),
    prisma.scriptLine.create({
      data: {
        sceneId: scene1.id,
        type: "DIALOGUE",
        character: "THOMAS",
        text: "I know that too.",
        sortOrder: 11,
      },
    }),
    prisma.scriptLine.create({
      data: {
        sceneId: scene1.id,
        type: "STAGE_DIRECTION",
        text: "Long pause. Margaret moves to the tea cart and pours two cups without asking. She hands one to Thomas. Their fingers touch. Neither pulls away.",
        sortOrder: 12,
      },
    }),
    prisma.scriptLine.create({
      data: {
        sceneId: scene1.id,
        type: "DIALOGUE",
        character: "MARGARET",
        text: "Sit down, Thomas. Tell me everything. And I mean everything.",
        sortOrder: 13,
      },
    }),
    prisma.scriptLine.create({
      data: {
        sceneId: scene1.id,
        type: "STAGE_DIRECTION",
        text: "They sit in the two chairs by the fire. Thomas stares into his tea. The clock strikes the half hour.",
        sortOrder: 14,
      },
    }),
    prisma.scriptLine.create({
      data: {
        sceneId: scene1.id,
        type: "DIALOGUE",
        character: "THOMAS",
        text: "Where do I even begin?",
        sortOrder: 15,
      },
    }),
    prisma.scriptLine.create({
      data: {
        sceneId: scene1.id,
        type: "STAGE_DIRECTION",
        text: "Slow blackout.",
        sortOrder: 16,
      },
    }),
  ]);

  // Scene 2 lines
  const s2Lines = await Promise.all([
    prisma.scriptLine.create({
      data: {
        sceneId: scene2.id,
        type: "STAGE_DIRECTION",
        text: "Morning light. Birds singing. The garden is overgrown but beautiful. MARGARET sits on a stone bench reading the letter. THOMAS appears from the house carrying two cups of coffee.",
        sortOrder: 1,
      },
    }),
    prisma.scriptLine.create({
      data: {
        sceneId: scene2.id,
        type: "DIALOGUE",
        character: "THOMAS",
        text: "You've read it then.",
        sortOrder: 2,
      },
    }),
    prisma.scriptLine.create({
      data: {
        sceneId: scene2.id,
        type: "DIALOGUE",
        character: "MARGARET",
        text: "Twice. (She folds the letter carefully) Thomas, did you know? Before last night — did you know?",
        sortOrder: 3,
      },
    }),
    prisma.scriptLine.create({
      data: {
        sceneId: scene2.id,
        type: "DIALOGUE",
        character: "THOMAS",
        text: "I suspected. That's not the same as knowing.",
        sortOrder: 4,
      },
    }),
  ]);

  console.log("  ✓ Script lines created");

  // Create cues
  await prisma.cue.createMany({
    data: [
      // Scene 1 cues
      { projectId: project.id, sceneId: scene1.id, lineId: s1Lines[0].id, type: "LIGHT", label: "LX Q1", number: 1, note: "Slow fade up to warm amber wash, 8 sec. Fireplace flicker effect on.", status: "APPROVED", duration: 8, createdById: lightingDesigner.id },
      { projectId: project.id, sceneId: scene1.id, lineId: s1Lines[0].id, type: "SOUND", label: "SND Q1", number: 1, note: "Fire crackling ambience, low volume. Clock ticking underscore.", status: "APPROVED", createdById: soundDesigner.id },
      { projectId: project.id, sceneId: scene1.id, lineId: s1Lines[0].id, type: "SET", label: "SET NOTE", number: 1, note: "Fireplace practical must be working. Clock hands set to 8:15. Window scrim backlit blue.", status: "APPROVED", createdById: stageManager.id },
      { projectId: project.id, sceneId: scene1.id, lineId: s1Lines[0].id, type: "PROPS", label: "PROP NOTE", number: 1, note: "Letter on side table (sealed). Tea set on cart USR. Margaret's shawl on chair.", status: "APPROVED", createdById: stageManager.id },
      { projectId: project.id, sceneId: scene1.id, lineId: s1Lines[1].id, type: "BLOCKING", label: "BLK 1", number: 1, note: "Margaret turns from window on 'eight o'clock.' Crosses DSC.", status: "APPROVED", createdById: stageManager.id },
      { projectId: project.id, sceneId: scene1.id, lineId: s1Lines[3].id, type: "SOUND", label: "SND Q2", number: 2, note: "Door knock effect — 3 sharp raps. Cut fire ambience to 50%.", status: "APPROVED", createdById: soundDesigner.id },
      { projectId: project.id, sceneId: scene1.id, lineId: s1Lines[3].id, type: "LIGHT", label: "LX Q2", number: 2, note: "Snap: tighten to pool on Margaret. Kill fireplace flicker.", status: "APPROVED", duration: 0, createdById: lightingDesigner.id },
      { projectId: project.id, sceneId: scene1.id, lineId: s1Lines[5].id, type: "LIGHT", label: "LX Q3", number: 3, note: "Widen wash to include doorway. Cool blue spill from door. 3 sec transition.", status: "APPROVED", duration: 3, createdById: lightingDesigner.id },
      { projectId: project.id, sceneId: scene1.id, lineId: s1Lines[5].id, type: "SOUND", label: "SND Q3", number: 3, note: "Rain and wind gust as door opens, fade to gentle rain after door closes.", status: "APPROVED", createdById: soundDesigner.id },
      { projectId: project.id, sceneId: scene1.id, lineId: s1Lines[5].id, type: "PROPS", label: "PROP Q2", number: 2, note: "Thomas carries wet suitcase (practical). Pre-set with water spray backstage.", status: "APPROVED", createdById: stageManager.id },
      { projectId: project.id, sceneId: scene1.id, lineId: s1Lines[10].id, type: "LIGHT", label: "LX Q4", number: 4, note: "Slow crossfade to warm two-shot. Fireplace flicker restored. 6 sec.", status: "APPROVED", duration: 6, createdById: lightingDesigner.id },
      { projectId: project.id, sceneId: scene1.id, lineId: s1Lines[10].id, type: "SOUND", label: "SND Q4", number: 4, note: "Rain fades to distant. Restore fire crackle to full. Add subtle underscore music cue M1.", status: "APPROVED", createdById: soundDesigner.id },
      { projectId: project.id, sceneId: scene1.id, lineId: s1Lines[11].id, type: "PROPS", label: "PROP Q3", number: 3, note: "Tea pot must be pre-filled with warm water. Two cups ready on cart. Saucers underneath.", status: "APPROVED", createdById: stageManager.id },
      { projectId: project.id, sceneId: scene1.id, lineId: s1Lines[12].id, type: "LIGHT", label: "LX Q5", number: 5, note: "Very slow fade to intimate warm. Isolate the two chairs. Background dims. 10 sec.", status: "REVIEW", duration: 10, createdById: lightingDesigner.id },
      { projectId: project.id, sceneId: scene1.id, lineId: s1Lines[13].id, type: "SOUND", label: "SND Q5", number: 5, note: "Clock chimes — half hour strike (single tone). Underscore M1 swells slightly.", status: "APPROVED", createdById: soundDesigner.id },
      { projectId: project.id, sceneId: scene1.id, lineId: s1Lines[15].id, type: "LIGHT", label: "LX Q6", number: 6, note: "Full blackout, 8 sec fade. Hold black 3 sec before scene change.", status: "APPROVED", duration: 8, createdById: lightingDesigner.id },
      { projectId: project.id, sceneId: scene1.id, lineId: s1Lines[15].id, type: "SOUND", label: "SND Q6", number: 6, note: "Fade all — fire, rain, underscore. Full silence by blackout.", status: "APPROVED", createdById: soundDesigner.id },

      // Scene 2 cues
      { projectId: project.id, sceneId: scene2.id, lineId: s2Lines[0].id, type: "LIGHT", label: "LX Q7", number: 7, note: "Fade up cool morning wash. Gobo: dappled leaf pattern DSC. No warm tones yet. 6 sec.", status: "DRAFT", duration: 6, createdById: lightingDesigner.id },
      { projectId: project.id, sceneId: scene2.id, lineId: s2Lines[0].id, type: "SOUND", label: "SND Q7", number: 7, note: "Bird song ambience. Gentle morning atmosphere. No music.", status: "DRAFT", createdById: soundDesigner.id },
      { projectId: project.id, sceneId: scene2.id, lineId: s2Lines[0].id, type: "SET", label: "SET Q2", number: 2, note: "Scene change: remove drawing room. Fly in garden drop. Stone bench CS. Trellis with ivy SR.", status: "APPROVED", createdById: stageManager.id },
      { projectId: project.id, sceneId: scene2.id, lineId: s2Lines[0].id, type: "PROPS", label: "PROP Q4", number: 4, note: "Letter from Scene 1 (now opened). Two coffee mugs. Garden gloves on bench.", status: "APPROVED", createdById: stageManager.id },
      { projectId: project.id, sceneId: scene2.id, lineId: s2Lines[3].id, type: "LIGHT", label: "LX Q8", number: 8, note: "Add warm side light from SR as sun 'rises.' Slow 15 sec transition.", status: "DRAFT", duration: 15, createdById: lightingDesigner.id },
    ],
  });

  console.log("  ✓ Cues created");
  console.log(`\n🎭 Seed complete!\n`);
  console.log(`   Project: "${project.title}"`);
  console.log(`   Users: ${5}`);
  console.log(`   Scenes: ${2}`);
  console.log(`   Script lines: ${s1Lines.length + s2Lines.length}`);
  console.log(`   Cues: 22\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
