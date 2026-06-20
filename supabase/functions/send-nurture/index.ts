// Runs hourly via pg_cron. Checks email_nurture for users who are due
// the next email in the 7-day sequence and sends it via Resend.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

const PHOEBE_NUMBER = '+44 7576 549490'
const SUBSCRIBE_BASIC = 'https://buy.stripe.com/7sY8wQcmSdWj9ki79F1ck01'
const SUBSCRIBE_PRO = 'https://buy.stripe.com/3csbJ2f9453H3ZYdRl1ck01'
const FROM = 'Chris from Phone Phoebe <onboarding@resend.dev>'

// email number → hours after confirmed_at before it sends
const SCHEDULE: { num: number; hours: number }[] = [
  { num: 2, hours: 24 },
  { num: 3, hours: 48 },
  { num: 4, hours: 96 },
  { num: 5, hours: 144 },
  { num: 6, hours: 168 },
  { num: 7, hours: 336 }, // winback — only non-converters
]

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
<tr><td style="background:#ffffff;padding:24px 40px;text-align:center;border-bottom:1px solid #e5e7eb;">
<img src="https://lrxuflxfnyiqzjqzjcsa.supabase.co/storage/v1/object/public/assets/logo.jpeg" alt="Phone Phoebe" width="240" style="display:block;margin:0 auto;max-width:240px;" />
</td></tr>
<tr><td style="padding:36px 40px;color:#1a1a2e;font-size:16px;line-height:1.8;">
${content}
</td></tr>
<tr><td style="padding:20px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:13px;color:#6b7280;">Phone Phoebe · <a href="https://phonephoebe.co.uk" style="color:#5cb85c;text-decoration:none;">phonephoebe.co.uk</a></p>
<p style="margin:6px 0 0;font-size:13px;color:#9ca3af;">Reply to this email to unsubscribe or ask anything.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

// ── Email 2 — Day 1 ────────────────────────────────────────────────────────
function email2Html(n: string) {
  return shell(`
<p style="margin:0 0 16px;">Hi ${n},</p>
<p style="margin:0 0 16px;">Quick check-in.</p>
<p style="margin:0 0 16px;"><strong>Has Phoebe answered a call yet?</strong></p>
<p style="margin:0 0 16px;">If yes — brilliant. She'll handle it exactly like a professional receptionist. The booking details come straight to your phone.</p>
<p style="margin:0 0 8px;"><strong>If not — here are the two most common reasons:</strong></p>
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
<p style="margin:0 0 10px;"><strong>1. Call forwarding isn't on yet.</strong> Takes 30 seconds. Your Phoebe number is <strong>${PHOEBE_NUMBER}</strong> — enter it exactly.</p>
<p style="margin:0;"><strong>2. The number isn't saved correctly.</strong> Double-check there are no extra spaces or missing digits.</p>
</div>
<p style="margin:0 0 24px;">If you're stuck, just reply to this email and I'll sort it personally.</p>
<p style="margin:0 0 4px;">Chris</p>`)
}

// ── Email 3 — Day 2 ────────────────────────────────────────────────────────
function email3Html(n: string) {
  return shell(`
<p style="margin:0 0 16px;">Hi ${n},</p>
<p style="margin:0 0 16px;">This email is going to mean one of two things depending on where you are.</p>
<p style="margin:0 0 16px;"><strong>If Phoebe is live:</strong> You may have already had a call she answered without you lifting a finger. Check your texts for the booking details — she sends them automatically.</p>
<p style="margin:0 0 16px;"><strong>If she's not live yet:</strong> Here's a thought experiment.</p>
<p style="margin:0 0 16px;">How many calls did you miss today while you were working?</p>
<p style="margin:0 0 16px;">If you had 3 jobs or lessons today, you were unreachable for 5–6 hours. In that window, statistically, 1–2 people tried to reach you. One probably called someone else.</p>
<div style="background:#fff7ed;border-left:4px solid #f59e0b;padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 20px;">
<p style="margin:0;font-size:18px;font-weight:700;color:#92400e;">At £38 a job, that's £38 gone. Today alone.<br/>Phoebe costs £39 a month.</p>
</div>
<p style="margin:0 0 24px;">Still need help getting set up? Just reply — we'll do it together in 2 minutes.</p>
<p style="margin:0 0 4px;">Chris</p>
<p style="margin:0;font-size:14px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px;">P.S. Your trial ends in 5 days. After that it's £39/month to keep Phoebe answering your calls.</p>`)
}

// ── Email 4 — Day 4 ────────────────────────────────────────────────────────
function email4Html(n: string) {
  return shell(`
<p style="margin:0 0 16px;">Hi ${n},</p>
<p style="margin:0 0 16px;">You're halfway through your free trial. How's it going?</p>
<p style="margin:0 0 16px;">I want to make sure you're getting the most out of Phoebe — here's everything she can do that you might not have explored yet:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
<tr><td style="padding:12px 0;border-bottom:1px solid #f0f0f0;vertical-align:top;width:36px;">📅</td>
<td style="padding:12px 0;border-bottom:1px solid #f0f0f0;"><strong>Calendar booking</strong><br/>Phoebe can book jobs or lessons directly into your calendar — no back-and-forth, the customer picks a slot and it's confirmed automatically.</td></tr>
<tr><td style="padding:12px 0;border-bottom:1px solid #f0f0f0;vertical-align:top;">📱</td>
<td style="padding:12px 0;border-bottom:1px solid #f0f0f0;"><strong>Instant text alerts</strong><br/>Every call gets a text to your phone with the caller's name, number and what they need. Even mid-job.</td></tr>
<tr><td style="padding:12px 0;border-bottom:1px solid #f0f0f0;vertical-align:top;">🎛️</td>
<td style="padding:12px 0;border-bottom:1px solid #f0f0f0;"><strong>On/off control</strong><br/>Turn Phoebe on for evenings and weekends only, or 24/7. You're always in control.</td></tr>
<tr><td style="padding:12px 0;vertical-align:top;">📋</td>
<td style="padding:12px 0;"><strong>Full call transcripts</strong><br/>Every call is transcribed and saved in your dashboard. Read exactly what was said, any time.</td></tr>
</table>
<p style="margin:0 0 24px;">Is there anything you're not sure how to use? Just reply and I'll help.</p>
<p style="margin:0 0 4px;">Chris</p>`)
}

// ── Email 5 — Day 6 ────────────────────────────────────────────────────────
function email5Html(n: string) {
  return shell(`
<p style="margin:0 0 16px;">Hi ${n},</p>
<p style="margin:0 0 16px;">Your free trial ends tomorrow.</p>
<p style="margin:0 0 16px;">If Phoebe has been answering your calls — you already know whether she's worth £39/month.</p>
<p style="margin:0 0 24px;">At £38 a job, she pays for herself the moment she books one call you would have missed.</p>
<p style="margin:0 0 28px;"><a href="${SUBSCRIBE_BASIC}" style="display:inline-block;background:#5cb85c;color:#fff;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">Keep Phoebe — £39/month →</a></p>
<p style="margin:0 0 16px;font-size:14px;color:#6b7280;">No contract. Cancel any time. Takes 30 seconds.</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
<p style="margin:0 0 16px;"><strong>If the trial didn't go to plan</strong> — I'd genuinely like to know why.</p>
<p style="margin:0 0 24px;">Did she not get set up in time? Did something not work? Did it feel wrong for your business? Reply and tell me. I'll either fix it or learn from it.</p>
<p style="margin:0 0 4px;">Either way — thank you for trying Phoebe.</p>
<p style="margin:0 0 24px;">Chris</p>
<p style="margin:0;font-size:14px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px;">P.S. If £39/month isn't right for you right now, the Professional plan at £89/month includes full calendar booking. If you're serious about never missing a booking again, that's the one. <a href="${SUBSCRIBE_PRO}" style="color:#5cb85c;">See Professional →</a></p>`)
}

// ── Email 6 — Day 7 ────────────────────────────────────────────────────────
function email6Html(n: string) {
  return shell(`
<p style="margin:0 0 16px;">Hi ${n},</p>
<p style="margin:0 0 24px;">Today's the last day of your free trial.</p>
<p style="margin:0 0 24px;">After midnight tonight, Phoebe will stop answering your calls.</p>
<p style="margin:0 0 28px;">If you want to keep her:</p>
<p style="margin:0 0 28px;"><a href="${SUBSCRIBE_BASIC}" style="display:inline-block;background:#5cb85c;color:#fff;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">Subscribe now — £39/month →</a></p>
<div style="background:#eaf7ea;border-radius:8px;padding:20px 24px;margin:0 0 24px;">
<p style="margin:0;font-size:15px;color:#374151;">The next call you miss while you're working is worth at least £38.<br/><strong>Phoebe costs £1.30 a day.</strong><br/><br/>The maths is easy. The decision is yours.</p>
</div>
<p style="margin:0 0 4px;">If you're not ready — no pressure. You can come back any time at <a href="https://phonephoebe.co.uk" style="color:#5cb85c;">phonephoebe.co.uk</a>.</p>
<p style="margin:0 0 24px;"><br/>Chris<br/>Phone Phoebe</p>`)
}

// ── Email 7 — Day 14 winback (non-converters only) ─────────────────────────
function email7Html(n: string) {
  return shell(`
<p style="margin:0 0 16px;">Hi ${n},</p>
<p style="margin:0 0 16px;">Your trial ended a week ago and I noticed you didn't continue.</p>
<p style="margin:0 0 24px;">No hard sell — I just want to ask one honest question:</p>
<p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#0F1729;"><strong>What would have made you say yes?</strong></p>
<p style="margin:0 0 24px;">Was it the price? Didn't get the chance to try it properly? Something didn't work? Not the right time?</p>
<p style="margin:0 0 24px;">Your answer will genuinely help me make Phoebe better. Just hit reply.</p>
<p style="margin:0 0 24px;">And if you ever want to try again — <strong>7 more days free, on me.</strong> Just reply to this email and I'll sort it.</p>
<p style="margin:0 0 4px;">Chris</p>`)
}

function getEmail(num: number, firstName: string): { subject: string; html: string } {
  const fns: Record<number, (n: string) => string> = {
    2: email2Html,
    3: email3Html,
    4: email4Html,
    5: email5Html,
    6: email6Html,
    7: email7Html,
  }
  const subjects: Record<number, string> = {
    2: "Did Phoebe answer her first call?",
    3: "The call you didn't know you missed",
    4: "Halfway through your trial — here's what Phoebe can do",
    5: "Your trial ends tomorrow",
    6: "Last day — keep Phoebe or she goes quiet",
    7: "Quick question",
  }
  return { subject: subjects[num], html: fns[num](firstName) }
}

Deno.serve(async () => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/email_nurture?select=*`, {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
      },
    })
    const users: any[] = await res.json()
    const now = Date.now()

    for (const user of users) {
      const sent: number[] = user.emails_sent || []
      const confirmedAt = new Date(user.confirmed_at).getTime()

      for (const { num, hours } of SCHEDULE) {
        if (sent.includes(num)) continue
        if (num === 7 && user.trial_converted) continue
        if (now < confirmedAt + hours * 3600 * 1000) continue

        const { subject, html } = getEmail(num, user.first_name || 'there')
        await sendEmail(user.email, subject, html)

        // Update emails_sent
        await fetch(`${SUPABASE_URL}/rest/v1/email_nurture?id=eq.${user.id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            apikey: SUPABASE_SERVICE_KEY,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ emails_sent: [...sent, num] }),
        })

        // Only one email per user per cron run — catches up next hour if more are due
        break
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: users.length }), { status: 200 })
  } catch (err) {
    console.error('send-nurture error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
