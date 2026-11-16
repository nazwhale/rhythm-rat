export function loginEmail(code: string) {
  return {
    subject: `${code} is your Rhythm Rat sign-in code`,
    text: `Your Rhythm Rat sign-in code:\n\n${code}\n\nEnter this four-digit code in the game to sign in.\nIt expires in 10 minutes.\n\nIf you did not request this code, ignore this email.`,
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Rhythm Rat sign-in code</title></head>
<body style="margin:0;padding:24px;background:#f3f6ef;color:#293c30;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" style="width:100%;max-width:480px;margin:0 auto;border-collapse:collapse"><tr><td style="padding:32px;background:#ffffff;border:1px solid #dce4d6;border-radius:12px">
    <h1 style="margin:0 0 20px;font-size:24px">Your Rhythm Rat sign-in code</h1>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.5">Enter this four-digit code in the game:</p>
    <p style="margin:0 0 24px;padding:20px 12px;background:#f3f6ef;text-align:center"><strong style="font-family:Arial,Helvetica,sans-serif;font-size:48px;line-height:1.2;font-weight:700;letter-spacing:8px;color:#293c30;white-space:nowrap">${code}</strong></p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.5">This code expires in <strong>10 minutes</strong>.</p>
    <p style="margin:0;font-size:14px;line-height:1.5;color:#59695d">If you did not request this code, ignore this email.</p>
  </td></tr></table>
</body></html>`,
  }
}
