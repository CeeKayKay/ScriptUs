const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const projects = await p.project.findMany({
    include: {
      members: { include: { user: { select: { email: true } } } },
      _count: { select: { scenes: true } },
    },
  });

  projects.forEach((pr) => {
    console.log(
      "Project:",
      pr.title,
      "| Members:",
      pr.members.map((m) => m.user.email + ":" + m.role).join(", "),
      "| Scenes:",
      pr._count.scenes
    );
  });

  if (projects.length === 0) console.log("No projects exist");

  // Check if calvku@gmail.com needs to be added to any project
  const calUser = await p.user.findUnique({ where: { email: "calvku@gmail.com" } });
  if (calUser) {
    const memberships = await p.projectMember.findMany({
      where: { userId: calUser.id },
    });
    console.log("\ncalvku@gmail.com memberships:", memberships.length);

    // If there's a project but cal isn't a member, add them as SM
    if (projects.length > 0 && memberships.length === 0) {
      await p.projectMember.create({
        data: {
          userId: calUser.id,
          projectId: projects[0].id,
          role: "STAGE_MANAGER",
        },
      });
      console.log("Added calvku@gmail.com as STAGE_MANAGER to:", projects[0].title);
    }
  }

  await p.$disconnect();
})();
