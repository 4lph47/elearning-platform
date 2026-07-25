import nodemailer from "nodemailer";

export function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Sem EMAIL_SERVER configurado (ambiente local/demo, ver .env.example),
// não há como enviar de verdade — cai para consola em vez de rebentar o
// registo, mesmo padrão "demo" do gateway de pagamento fake.
export async function sendVerificationCodeEmail(to: string, code: string): Promise<void> {
  if (!process.env.EMAIL_SERVER) {
    console.log(`[dev] Código de verificação para ${to}: ${code}`);
    return;
  }

  const transport = nodemailer.createTransport(process.env.EMAIL_SERVER);
  await transport.sendMail({
    to,
    from: process.env.EMAIL_FROM,
    subject: "O teu código de verificação",
    text: `O teu código de verificação é: ${code}\n\nExpira em 15 minutos.`,
    html: `<p>O teu código de verificação é:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;">${code}</p><p>Expira em 15 minutos.</p>`,
  });
}
