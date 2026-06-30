import "server-only";
import nodemailer from "nodemailer";

/**
 * 이메일 발송 — Gmail SMTP (서버 전용).
 *
 * 필요한 환경변수 (.env.local / Vercel 환경변수):
 *   - GMAIL_USER         : 발송 Gmail 주소 (예: myclub@gmail.com)
 *   - GMAIL_APP_PASSWORD : Google 앱 비밀번호 16자리 (일반 비밀번호 아님)
 *   - MAIL_FROM          : (선택) 표시용 발신자. 미설정 시 GMAIL_USER 사용.
 *
 * 미설정 시 isEmailConfigured()=false → 호출부는 화면 표시로 폴백한다.
 */

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const MAIL_FROM = process.env.MAIL_FROM ?? GMAIL_USER;

export function isEmailConfigured(): boolean {
  return !!GMAIL_USER && !!GMAIL_APP_PASSWORD;
}

let transporter: nodemailer.Transporter | null = null;
function getTransporter() {
  if (!isEmailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
}

/** 메일 발송. 성공 true / 미설정·실패 false. */
export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  const tx = getTransporter();
  if (!tx) return false;
  try {
    await tx.sendMail({
      from: `GUITAR TOGETHER <${MAIL_FROM}>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return true;
  } catch (e) {
    console.error("[email] 발송 실패:", e);
    return false;
  }
}
