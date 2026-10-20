type VerificationEmail = {
  to: string;
  displayName: string;
  verificationUrl: string;
  purpose: "signup" | "password-change";
};

export type EmailDelivery = { provider: "console" | "resend"; previewUrl?: string };

export async function sendVerificationEmail(input: VerificationEmail): Promise<EmailDelivery> {
  const provider = (process.env.EMAIL_DATA_PROVIDER || "console").toLowerCase();
  if (provider === "console") return { provider: "console", previewUrl: input.verificationUrl };
  if (provider !== "resend") throw new Error(`Unsupported email provider: ${provider}`);
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("RESEND_API_KEY and EMAIL_FROM are required for Resend delivery.");
  const action = input.purpose === "signup" ? "verify your Sports Watch account" : "confirm your Sports Watch password change";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.purpose === "signup" ? "Verify your Sports Watch email" : "Confirm your Sports Watch password change",
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h1>Sports Watch</h1><p>Hi ${escapeHtml(input.displayName)},</p><p>Use the button below to ${action}.</p><p><a href="${escapeHtml(input.verificationUrl)}" style="background:#4d8dff;color:white;padding:12px 18px;border-radius:6px;text-decoration:none">Verify email</a></p><p>This link expires in 24 hours. If you did not request this, you can ignore this email.</p></div>`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Email delivery failed with ${response.status}.`);
  return { provider: "resend" };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[character] ?? character);
}
