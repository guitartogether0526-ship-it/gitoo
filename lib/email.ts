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

/**
 * 기투 테마(다크+앰버) 카드형 이메일 HTML.
 * 이메일 클라이언트 호환을 위해 테이블 + 인라인 스타일만 사용.
 */
export function emailHtml(opts: {
  heading: string;
  intro?: string;
  highlight?: { label: string; value: string };
  rows?: { label: string; value: string }[];
  note?: string;
}): string {
  const C = {
    bg: "#181311",
    card: "#241d19",
    border: "#3a2f28",
    amber: "#e0a96d",
    text: "#f0e9e2",
    dim: "#a99a8d",
  };
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const rowsHtml = (opts.rows ?? [])
    .map(
      (r) => `
      <tr>
        <td style="padding:7px 0;color:${C.dim};font-size:13px;width:90px;vertical-align:top;">${esc(r.label)}</td>
        <td style="padding:7px 0;color:${C.text};font-size:14px;font-weight:600;">${esc(r.value)}</td>
      </tr>`,
    )
    .join("");

  const highlightHtml = opts.highlight
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;">
      <tr><td align="center" style="border:1px solid ${C.amber};border-radius:12px;padding:16px;">
        <div style="color:${C.dim};font-size:12px;margin-bottom:6px;">${esc(opts.highlight.label)}</div>
        <div style="color:${C.amber};font-size:24px;font-weight:800;letter-spacing:1px;">${esc(opts.highlight.value)}</div>
      </td></tr>
    </table>`
    : "";

  return `<!doctype html><html><body style="margin:0;padding:0;background:${C.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;width:100%;">
        <tr><td align="center" style="padding-bottom:18px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="border:2px solid #ffffff;border-radius:8px;padding:8px 16px;">
            <div style="color:#fff;font-size:20px;font-weight:800;letter-spacing:1px;font-family:Arial,Helvetica,sans-serif;line-height:1;">GUITAR</div>
            <div style="border-top:1.5px solid #fff;margin:5px 0;"></div>
            <div style="color:#fff;font-size:10px;font-weight:600;letter-spacing:3px;font-family:Arial,Helvetica,sans-serif;line-height:1;">TOGETHER</div>
          </td></tr></table>
        </td></tr>
        <tr><td style="background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:24px;">
          <div style="color:${C.amber};font-size:18px;font-weight:800;margin-bottom:10px;font-family:Arial,Helvetica,sans-serif;">${esc(opts.heading)}</div>
          ${opts.intro ? `<div style="color:${C.text};font-size:14px;line-height:1.6;">${esc(opts.intro)}</div>` : ""}
          ${highlightHtml}
          ${rowsHtml ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">${rowsHtml}</table>` : ""}
          ${opts.note ? `<div style="color:${C.dim};font-size:12px;line-height:1.6;margin-top:16px;">${esc(opts.note)}</div>` : ""}
        </td></tr>
        <tr><td align="center" style="padding-top:16px;color:${C.dim};font-size:11px;font-family:Arial,Helvetica,sans-serif;">
          기타투게더 · 기타 밴드 동호회
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`;
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
      from: `기타투게더 <${MAIL_FROM}>`,
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
