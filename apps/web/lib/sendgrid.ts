import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL!;
const APP_URL = process.env.NEXTAUTH_URL!;

export async function sendNewsNotification(
  to: string,
  date: string,
  articles: { aiName: string; title: string; summary: string }[],
  ceoInsight: string
) {
  const articleItems = articles
    .slice(0, 3)
    .map(
      (a) =>
        `<tr><td style="padding:12px 0;border-bottom:1px solid #eee">
          <strong style="color:#1d4ed8">${a.aiName}</strong><br>
          <span style="font-weight:600">${a.title}</span><br>
          <span style="color:#64748b;font-size:13px">${a.summary.slice(0, 100)}...</span>
        </td></tr>`
    )
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1e3a5f;color:white;padding:20px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:20px">AI Insight Daily</h1>
        <p style="margin:4px 0 0;opacity:0.8;font-size:14px">${date} のAIニュース</p>
      </div>
      <div style="background:white;padding:20px;border:1px solid #e2e8f0;border-top:none">
        <h2 style="font-size:16px;color:#1e293b">本日の注目ニュース</h2>
        <table style="width:100%">${articleItems}</table>
        <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:16px;margin-top:16px;border-radius:0 8px 8px 0">
          <strong style="color:#1d4ed8;font-size:13px">💡 CEO向け示唆</strong>
          <p style="color:#1e40af;font-size:13px;margin:8px 0 0">${ceoInsight.slice(0, 200)}...</p>
        </div>
        <div style="text-align:center;margin-top:20px">
          <a href="${APP_URL}/news" style="background:#1d4ed8;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">続きを読む →</a>
        </div>
      </div>
      <div style="padding:16px;text-align:center;font-size:12px;color:#94a3b8">
        <a href="${APP_URL}/settings" style="color:#94a3b8">通知設定を変更</a> ·
        <a href="${APP_URL}/settings?unsubscribe=1" style="color:#94a3b8">配信停止</a>
      </div>
    </div>`;

  await sgMail.send({
    to,
    from: FROM_EMAIL,
    subject: `【AI Insight Daily】${date} のAIニュースが更新されました`,
    html,
    text: `AI Insight Daily ${date}\n\n${articles
      .map((a) => `[${a.aiName}] ${a.title}`)
      .join("\n")}\n\n${APP_URL}/news`,
  });
}

export async function sendWelcomeEmail(to: string, displayName: string) {
  await sgMail.send({
    to,
    from: FROM_EMAIL,
    subject: "【AI Insight Daily】ご登録ありがとうございます",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h1 style="color:#1e3a5f">ようこそ、AI Insight Dailyへ！</h1>
        <p>${displayName ?? ""}さん、ご登録ありがとうございます。</p>
        <p>30日間の無料トライアルが始まりました。毎朝のAIニュースと経営示唆をお楽しみください。</p>
        <a href="${APP_URL}/news" style="background:#1d4ed8;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px">ニュースを見る →</a>
      </div>`,
    text: `ようこそ AI Insight Daily へ！\n30日間の無料トライアルが始まりました。\n${APP_URL}/news`,
  });
}
