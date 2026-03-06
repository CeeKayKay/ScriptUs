const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  // Find all members
  const allMembers = await p.projectMember.findMany();
  console.log("Total members:", allMembers.length);

  // Fix members with empty roles
  for (const m of allMembers) {
    if (!m.roles || m.roles.length === 0) {
      await p.projectMember.update({ where: { id: m.id }, data: { roles: ["VIEWER"] } });
      console.log("Fixed member", m.id, "-> VIEWER");
    }
  }

  // Set calvku as Stage Manager for Fish Show
  const user = await p.user.findUnique({ where: { email: "calvku@gmail.com" } });
  if (!user) {
    console.log("User calvku@gmail.com not found");
    await p.$disconnect();
    return;
  }

  const projects = await p.project.findMany({ where: { title: { contains: "Fish" } } });
  console.log("Fish projects:", projects.map((pr) => ({ id: pr.id, title: pr.title })));

  for (const proj of projects) {
    const membership = await p.projectMember.findUnique({
      where: { userId_projectId: { userId: user.id, projectId: proj.id } },
    });
    if (membership) {
      const roles = membership.roles.includes("STAGE_MANAGER")
        ? membership.roles
        : ["STAGE_MANAGER", ...membership.roles];
      await p.projectMember.update({ where: { id: membership.id }, data: { roles } });
      console.log("Updated", user.email, "roles to", roles, "for", proj.title);
    } else {
      await p.projectMember.create({
        data: { userId: user.id, projectId: proj.id, roles: ["STAGE_MANAGER"] },
      });
      console.log("Created STAGE_MANAGER membership for", user.email, "in", proj.title);
    }
  }

  await p.$disconnect();
})();
