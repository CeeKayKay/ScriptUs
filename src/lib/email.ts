import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendInviteEmail({
  to,
  projectTitle,
  role,
  inviterName,
  acceptUrl,
}: {
  to: string;
  projectTitle: string;
  role: string;
  inviterName: string;
  acceptUrl: string;
}) {
  const roleLabel = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  await transporter.sendMail({
    from: `"ScriptUs" <${process.env.SMTP_USER}>`,
    to,
    subject: `You've been invited to "${projectTitle}" on ScriptUs`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #1a1916; color: #e0ddd5; border-radius: 12px;">
        <h1 style="color: #E8C547; font-size: 24px; margin-bottom: 4px;">◆ SCRIPTUS</h1>
        <p style="color: #888; font-size: 12px; font-family: monospace; margin-bottom: 24px;">Collaborative Script Management</p>

        <p style="font-size: 16px; line-height: 1.6;">
          <strong>${inviterName}</strong> has invited you to join
          <strong style="color: #E8C547;">"${projectTitle}"</strong>
          as <strong style="color: #47B8E8;">${roleLabel}</strong>.
        </p>

        <a href="${acceptUrl}" style="display: inline-block; margin-top: 24px; padding: 12px 32px; background: #E8C54720; border: 1px solid #E8C54760; color: #E8C547; text-decoration: none; border-radius: 8px; font-family: monospace; font-size: 14px; font-weight: bold;">
          Accept Invitation
        </a>

        <p style="margin-top: 24px; font-size: 12px; color: #666; font-family: monospace;">
          This invitation expires in 7 days. If you didn't expect this email, you can ignore it.
        </p>
      </div>
    `,
  });
}
