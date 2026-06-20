// Triggered by a pg_net call from auth.users UPDATE trigger.
// Fires when a user confirms their email — inserts into email_nurture
// and sends Email 1 immediately via Resend.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

const PHOEBE_NUMBER = '+44 7576 549490'
const DASHBOARD_URL = 'https://phonephoebe.co.uk/dashboard.html'
const FROM = 'Chris from Phone Phoebe <noreply@phonephoebe.co.uk>'

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  if (!res.ok) console.error('Resend error:', await res.text())
}

function shell(content: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td>
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
<tr><td style="background:#0F1729;padding:24px 40px;">
<span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">📞 Phone Phoebe</span>
</td></tr>
<tr><td style="padding:36px 40px;color:#1a1a2e;font-size:16px;line-height:1.8;">
${content}
</td></tr>
<tr><td style="padding:20px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:13px;color:#6b7280;">Phone Phoebe · <a href="https://phonephoebe.co.uk" style="color:#6366f1;text-decoration:none;">phonephoebe.co.uk</a></p>
<p style="margin:6px 0 0;font-size:13px;color:#9ca3af;">Reply to this email to unsubscribe or ask anything.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

function email1Html(firstName: string): string {
  return shell(`
<p style="margin:0 0 16px;">Hi ${firstName},</p>
<p style="margin:0 0 16px;">Welcome to Phone Phoebe. Your 7-day free trial starts now.</p>
<p style="margin:0 0 8px;"><strong>The one thing I need you to do today:</strong></p>
<p style="margin:0 0 16px;">Forward your calls to Phoebe. That's it. Here's exactly how:</p>
<div style="background:#f0f4ff;border-left:4px solid #6366f1;padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 20px;">
<p style="margin:0 0 10px;">→ <strong>iPhone:</strong> Settings → Phone → Call Forwarding → On → enter your Phoebe number</p>
<p style="margin:0;">→ <strong>Android:</strong> Phone app → Settings → Supplementary services → Call forwarding → Always forward</p>
</div>
<p style="margin:0 0 8px;">Your Phoebe number:</p>
<p style="margin:0 0 24px;font-size:22px;font-weight:700;color:#0F1729;letter-spacing:1px;">${PHOEBE_NUMBER}</p>
<p style="margin:0 0 24px;">Once forwarding is on, call your own number from another phone and see what happens. That's the moment it clicks.</p>
<p style="margin:0 0 28px;"><a href="${DASHBOARD_URL}" style="display:inline-block;background:#6366f1;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Go to your dashboard →</a></p>
<p style="margin:0 0 4px;">Any questions — just reply to this email. I read every one.</p>
<p style="margin:0 0 24px;">Chris<br/>Phone Phoebe</p>
<p style="margin:0;font-size:14px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px;">P.S. Phoebe already knows your business — your prices, your hours, your FAQs. You don't need to train her. She's ready.</p>`)
}

Deno.serve(async (req) => {
  try {
    const { user_id, email, first_name } = await req.json()
    const fname = (first_name || '').split(' ')[0] || 'there'

    // Insert into nurture table — ignore duplicate (user confirming twice)
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/email_nurture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id,
        email,
        first_name: fname,
        confirmed_at: new Date().toISOString(),
        emails_sent: [1],
      }),
    })

    if (!insertRes.ok && insertRes.status !== 409) {
      console.error('Insert error:', await insertRes.text())
      return new Response('insert failed', { status: 500 })
    }

    if (insertRes.status === 409) {
      // Already processed this user
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 })
    }

    await sendEmail(
      email,
      "You're in — here's how to get Phoebe answering calls today",
      email1Html(fname)
    )

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err) {
    console.error('on-signup error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
