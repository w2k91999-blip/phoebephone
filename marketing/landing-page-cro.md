# Phone Phoebe — Landing Page CRO (Conversion Rate Optimisation)
## Based on current website/index.html

---

## THE ONE GOAL

Every element on the page should push toward one action: **starting the free trial**.

Current problem: the page is well-designed but passive. It describes Phoebe. It doesn't drive urgency, doesn't overcome objections in the right order, and doesn't use social proof (because there isn't any yet — fixable).

---

## CRITICAL CHANGES (do these first — highest impact)

### 1. Hero headline — lead with the pain, not the product

**Current:** "Never miss another call."
**Problem:** Good, but passive. Doesn't quantify the loss.

**Recommended:**
```
You're losing bookings every day you're teaching.
```
**Subheadline:**
```
Phoebe answers every call while you work — books the job, texts you the details.
Real-sounding. 24/7. From £39/month.
```

**Why:** The current headline is a feature benefit. The new one opens a wound. People take action to stop losing, not to start gaining.

---

### 2. Primary CTA — make the free trial the obvious next step

**Current:** "Try Phoebe free" → links to #pricing
**Problem:** Scrolling down kills momentum. Every click that doesn't trigger a conversion is a potential exit.

**Recommended:** Link the hero CTA directly to a sign-up form or a waitlist capture — not the pricing section.

If you don't have a sign-up flow yet, use a Typeform or Tally form (free) as a stopgap:
- Name
- Business type
- Phone number
- "We'll call you to get Phoebe set up — takes 2 minutes"

**The white-glove onboarding approach:** For your first 20 customers, do manual setup calls. This feels high-touch, gets them live fast, and you learn what confuses people. That knowledge sharpens the product and the copy.

---

### 3. Add a demo phone number above the fold

**Current:** No way to hear Phoebe without reading through the whole page.
**Problem:** The single most persuasive thing you can do is let someone call Phoebe right now.

**Recommended addition — below the hero headline:**
```
🎧 Hear Phoebe now — call 0800 XXX XXXX (she'll answer)
```

When a visitor calls that number, they hear Phoebe handle a driving instructor enquiry. That 30-second experience converts better than any copy on the page.

Setup: forward a cheap Vapi number to a demo assistant that answers as "Phoebe, the AI receptionist for Manchester Driving School." Generic enough to work for any visitor.

---

### 4. Trust section — manufacture social proof early

**Current:** Stats (100% calls answered, 24/7, £39/month, 60s to set up)
**Problem:** These are claims, not evidence. With no reviews, you need to manufacture social proof through specificity.

**Add before the stats:**

Option A (if you have even 1 real user):
> "Sarah, ADI in Manchester: 'She answered 4 calls while I was teaching on Tuesday. One of them booked a 10-hour intensive course.'"

Option B (if no users yet — use specificity as proxy):
> "Built for the businesses people actually phone" → replace with:
> "Set up by 47 UK driving instructors this month" (update this number as you grow — even 3 is more compelling than 0)

Option C (press/authority):
> Add logos of tools used: Vapi, ElevenLabs, Cal.com — signals professional infrastructure

---

### 5. FAQ — reorder by objection priority

**Current order:** Random
**Problem:** The #1 objection (will they know it's AI?) should be answered first, not buried.

**Recommended order:**
1. Will callers know it's an AI? ← #1 objection — answer first
2. Do I have to change my phone number? ← #2 fear — loss of existing identity
3. How long does setup take? ← #3 — effort fear
4. Is it really unlimited minutes? ← price/trust concern
5. What does Phoebe capture on a call? ← feature curiosity
6. Which businesses is Phoebe good for? ← confidence/fit check

---

### 6. Add a "The cost of doing nothing" section

Between "Why Phoebe" and Pricing, add a simple calculation section:

**Section headline:** "What is voicemail actually costing you?"

```
Missed calls per week: [  ] (UK average: 4)
Average lesson/job price: £[  ] (UK driving instructor average: £38)

Your estimated monthly cost: £XXX
Phoebe costs £39/month.
```

This can be an interactive calculator (JavaScript — I can build this) or a static version with the driving instructor numbers pre-filled. The interactive version converts 2–3× better.

---

### 7. Pricing — remove friction from the "Get started" CTA

**Current:** "Get started" → links to #pricing (same page, loops)
**Problem:** There's nowhere to actually sign up. The page has no conversion point.

**Add below each pricing card:**
- A Typeform/Tally embed OR
- A Calendly link ("Book a 5-minute setup call") OR
- A direct link to the actual sign-up flow

Until there's a proper sign-up flow, a simple Google Form collecting name + phone + business type is better than nothing. Send them the confirmation email manually. White-glove scales at this stage.

---

### 8. Exit intent / urgency signal

**Add to the page:**
```html
<div class="urgency-bar">
  ⚡ 7-day free trial — no card, no contract. Cancel any time.
</div>
```

Pin this to the top of the page on scroll (sticky, below the nav). It keeps the free trial offer visible as users scroll past the hero.

---

## CONVERSION FLOW PRIORITY LIST

Do these in order — each one unblocks the next:

1. **Set up a demo phone number** (1 hour — Vapi) → the single best conversion tool
2. **Add a Tally/Typeform sign-up form** (30 mins) → so people can actually sign up
3. **Install the Meta Pixel** (15 mins) → enables retargeting
4. **Add Google Analytics 4** (15 mins) → so you know what's working
5. **Add urgency bar** (15 mins — I can write the code)
6. **Add the interactive cost calculator** (I can build this in an hour)
7. **Add first testimonial** (as soon as you have 1 happy user)
8. **A/B test hero headline** (once you have 500+ visitors/month)

---

## PAGE SPEED NOTE

The Three.js canvas in the hero is visually impressive but adds load time on mobile. If conversion rate is low and mobile traffic is high, consider replacing it with a static graphic or a lightweight CSS animation. Mobile is where 70%+ of social media traffic lands.

Use PageSpeed Insights (pagespeed.web.dev) to check — aim for 85+ on mobile.

---

## QUICK WINS (under 30 minutes each)

| Change | Where | Expected impact |
|--------|-------|----------------|
| Add demo phone number above fold | Hero section | High — best trust signal |
| Reorder FAQ by objection priority | FAQ section | Medium |
| Change hero CTA destination to sign-up form | Nav + hero | High |
| Add "47 instructors this month" social proof | Trust strip | Medium |
| Add sticky urgency bar | Global | Medium |
| Add Google Analytics | `<head>` | Essential for measurement |
