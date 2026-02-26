// lib/mailer.ts
// Nodemailer transport using SuperHosting SMTP env vars.

import nodemailer from 'nodemailer';

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: process.env.SMTP_SECURE !== 'false', // default true (465)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendMagicLinkEmail(to: string, token: string): Promise<void> {
  const appUrl = process.env.APP_URL || 'https://afterme.life';
  const link = `${appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;
  const from = process.env.MAIL_FROM || 'MEafterMe <no-reply@afterme.life>';
  const transport = createTransport();

  await transport.sendMail({
    from,
    to,
    subject: 'Your MEafterMe sign-in link',
    text: `Click the link below to sign in to MEafterMe (link expires in 30 minutes):\n\n${link}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#f8f9ff;border-radius:12px;">
        <h2 style="color:#1c31d9;margin-bottom:8px;">MEafterMe</h2>
        <p style="color:#374151;font-size:16px;margin-bottom:24px;">Click the button below to sign in. This link expires in <strong>30 minutes</strong>.</p>
        <a href="${link}" style="display:inline-block;background:#3b5bfc;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">Sign in to MEafterMe</a>
        <p style="color:#9ca3af;font-size:13px;margin-top:24px;">If you didn't request this email, you can safely ignore it.</p>
        <p style="color:#9ca3af;font-size:12px;margin-top:4px;">afterme.life</p>
      </div>
    `,
  });
}

export async function sendWaitlistConfirmEmail(to: string): Promise<void> {
  const from = process.env.MAIL_FROM || 'MEafterMe <no-reply@afterme.life>';
  const transport = createTransport();
  const appUrl = process.env.APP_URL || 'https://afterme.life';

  await transport.sendMail({
    from,
    to,
    subject: "You're on the MEafterMe waitlist",
    text: `Thanks for joining the MEafterMe private beta waitlist!\n\nWhen you receive an invite code, visit ${appUrl}/invite to enter it and get approved.\n\n— The MEafterMe team`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#f8f9ff;border-radius:12px;">
        <h2 style="color:#1c31d9;margin-bottom:8px;">You're on the waitlist!</h2>
        <p style="color:#374151;font-size:16px;">Thanks for joining the <strong>MEafterMe private beta</strong> waitlist.</p>
        <p style="color:#374151;font-size:15px;">When you receive an invite code, visit <a href="${appUrl}/invite" style="color:#3b5bfc;">${appUrl}/invite</a> to activate your access.</p>
        <p style="color:#9ca3af;font-size:13px;margin-top:24px;">afterme.life</p>
      </div>
    `,
  });
}
