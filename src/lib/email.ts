import nodemailer from "nodemailer";

function createTransporter(smtpUser?: string, smtpPass?: string) {
  const user = smtpUser || process.env.SMTP_USER;
  const pass = smtpPass || process.env.SMTP_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
  userName,
  smtpUser,
  smtpPass,
}: {
  to: string;
  resetUrl: string;
  userName: string;
  smtpUser?: string;
  smtpPass?: string;
}) {
  const transporter = createTransporter(smtpUser, smtpPass);
  if (!transporter) throw new Error("No SMTP credentials configured");
  const fromEmail = smtpUser || process.env.SMTP_USER;

  await transporter.sendMail({
    from: `"ScriptUs" <${fromEmail}>`,
    to,
    subject: "Reset your ScriptUs password",
    html: `
      <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #1a1916; color: #e0ddd5; border-radius: 12px;">
        <h1 style="color: #E8C547; font-size: 24px; margin-bottom: 4px;">◆ SCRIPTUS</h1>
        <p style="color: #888; font-size: 12px; font-family: monospace; margin-bottom: 24px;">Password Reset</p>

        <p style="font-size: 16px; line-height: 1.6;">
          Hi <strong>${userName}</strong>, we received a request to reset your password.
        </p>

        <a href="${resetUrl}" style="display: inline-block; margin-top: 24px; padding: 12px 32px; background: #E8C54720; border: 1px solid #E8C54760; color: #E8C547; text-decoration: none; border-radius: 8px; font-family: monospace; font-size: 14px; font-weight: bold;">
          Reset Password
        </a>

        <p style="margin-top: 24px; font-size: 12px; color: #666; font-family: monospace;">
          This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

export async function sendInviteEmail({
  to,
  projectTitle,
  role,
  inviterName,
  acceptUrl,
  smtpUser,
  smtpPass,
}: {
  to: string;
  projectTitle: string;
  role: string;
  inviterName: string;
  acceptUrl: string;
  smtpUser?: string;
  smtpPass?: string;
}) {
  const transporter = createTransporter(smtpUser, smtpPass);
  if (!transporter) throw new Error("No SMTP credentials configured");
  const fromEmail = smtpUser || process.env.SMTP_USER;
  const roleLabel = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  await transporter.sendMail({
    from: `"ScriptUs" <${fromEmail}>`,
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
