#!/usr/bin/env python3
"""
Viral ad builder for Phone Phoebe.
Poster background + Ken Burns zoom + on-mute captions + CTA end card.
9:16, 1080x1920.
"""
import os, subprocess, shutil
from PIL import Image, ImageDraw, ImageFont

HERE   = os.path.dirname(os.path.abspath(__file__))
POSTER = os.path.join(HERE, "poster.jpeg")
AUDIO  = os.path.join(HERE, "phoebe-demo-call-padded.mp3")
FRAMES = os.path.join(HERE, "ad_frames")
OUT    = os.path.join(HERE, "phoebe-viral-ad.mp4")

W, H, FPS = 1080, 1920, 30
CALL_END  = 36.5          # poster section ends
TOTAL     = 39.5          # + CTA card

# ── Captions (start, end, speaker, text) — short, mute-readable ───────────────
CAPS = [
    (0.0,  3.0,  "caller", "Hi, have you got any lessons free this week?"),
    (3.6,  9.9,  "phoebe", "Yes! Tuesday at 2pm or Thursday at 10am —\nwhich suits you?"),
    (10.4, 12.1, "caller", "Tuesday's perfect."),
    (12.6, 16.8, "phoebe", "Can I take your name and number\nto confirm?"),
    (17.3, 21.7, "caller", "It's Sam — 07700 900123."),
    (22.2, 31.0, "phoebe", "Perfect Sam — you're booked in\nfor Tuesday at 2pm."),
    (31.5, 33.6, "caller", "No, that's great. Thank you!"),
    (34.1, 36.4, "phoebe", "Brilliant — speak soon!"),
]

PURPLE = (99, 78, 255)
WHITE  = (255, 255, 255)
NAVY   = (15, 23, 41)

def font(size, bold=True):
    for p in ["/System/Library/Fonts/Helvetica.ttc",
              "/Library/Fonts/Arial Bold.ttf",
              "/System/Library/Fonts/Supplemental/Arial Bold.ttf"]:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except: pass
    return ImageFont.load_default()

F_CAP   = font(46)
F_SPK   = font(28)
F_CTA1  = font(82)
F_CTA2  = font(58)
F_CTA3  = font(40)
F_URL   = font(44)

# Pre-scale poster once per zoom step is costly; cache base.
BASE = Image.open(POSTER).convert("RGB")

def ease(t): return t*t*(3-2*t)   # smoothstep

def ken_burns(t):
    """Return a 1080x1920 crop of the poster with subtle zoom+pan."""
    p = min(max(t/CALL_END, 0), 1)
    zoom = 1.0 + 0.08*ease(p)                      # 8% slow zoom-in
    scaled_w = int(W*zoom*1.001)
    scaled_h = int(scaled_w * BASE.height/BASE.width)
    if scaled_h < int(H*zoom):
        scaled_h = int(H*zoom)
        scaled_w = int(scaled_h * BASE.width/BASE.height)
    img = BASE.resize((scaled_w, scaled_h), Image.LANCZOS)
    # pan center: drift right+up toward the phone/conversation
    cx = 0.5 + 0.05*ease(p)
    cy = 0.5 - 0.04*ease(p)
    left = int(scaled_w*cx - W/2)
    top  = int(scaled_h*cy - H/2)
    left = max(0, min(left, scaled_w-W))
    top  = max(0, min(top, scaled_h-H))
    return img.crop((left, top, left+W, top+H))

def rounded(draw, box, r, fill):
    draw.rounded_rectangle(box, radius=r, fill=fill)

def draw_caption(img, t):
    cur = next((c for c in CAPS if c[0] <= t <= c[1]), None)
    if not cur: return
    _, _, speaker, text = cur
    d = ImageDraw.Draw(img, "RGBA")
    lines = text.split("\n")
    lh = F_CAP.getbbox("Ag")[3] + 14
    block_h = len(lines)*lh
    pad = 34
    # measure width
    maxw = max(d.textbbox((0,0), l, font=F_CAP)[2] for l in lines)
    bw = min(W-80, maxw + pad*2)
    spk_label = "PHOEBE" if speaker=="phoebe" else "CALLER"
    spk_col = (190,175,255) if speaker=="phoebe" else (200,210,225)
    # position: lower third, above brand zone
    y0 = 1330
    x0 = (W-bw)//2
    # speaker pill
    sb = d.textbbox((0,0), spk_label, font=F_SPK)
    pill_w = sb[2]+36
    rounded(d, (W//2-pill_w//2, y0-58, W//2+pill_w//2, y0-10), 24,
            (PURPLE+(235,)) if speaker=="phoebe" else (40,52,74,235))
    d.text((W//2-sb[2]//2, y0-52), spk_label, font=F_SPK, fill=WHITE)
    # caption bg
    rounded(d, (x0, y0, x0+bw, y0+block_h+pad*2), 28, (10,15,28,205))
    ty = y0+pad
    for l in lines:
        tb = d.textbbox((0,0), l, font=F_CAP)
        d.text(((W-tb[2])//2, ty), l, font=F_CAP, fill=WHITE)
        ty += lh

def draw_hook_flash(img, t):
    """First 2s: subtle bottom prompt to boost retention."""
    if t > 2.2: return
    a = int(255 * (1 - t/2.2))
    d = ImageDraw.Draw(img, "RGBA")
    txt = "🔊 Listen to a real call"
    tb = d.textbbox((0,0), txt, font=F_SPK)
    d.text(((W-tb[2])//2, 1250), txt, font=F_SPK, fill=(255,255,255,a))

def cta_card(t):
    """End card after the call."""
    img = BASE.resize((W, int(W*BASE.height/BASE.width)), Image.LANCZOS).crop((0,0,W,H))
    ov = Image.new("RGBA", (W,H), (10,14,26,225))
    img = Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB")
    d = ImageDraw.Draw(img)
    p = min((t-CALL_END)/0.5, 1)   # quick fade-in
    def ctext(y, s, f, col=WHITE):
        b = d.textbbox((0,0), s, font=f)
        d.text(((W-b[2])//2, y), s, font=f, fill=col)
    ctext(560, "Never miss", F_CTA1)
    ctext(650, "a booking again.", F_CTA1)
    # CTA button
    btn = "Try Phoebe FREE for 7 days"
    bb = d.textbbox((0,0), btn, font=F_CTA3)
    bw, bh = bb[2]+90, 110
    bx, by = (W-bw)//2, 880
    d.rounded_rectangle((bx,by,bx+bw,by+bh), radius=55, fill=PURPLE)
    d.text(((W-bb[2])//2, by+34), btn, font=F_CTA3, fill=WHITE)
    ctext(1050, "No card · Keep your number · Cancel any time", F_SPK, (190,200,215))
    ctext(1180, "📞 phonephoebe.co.uk", F_URL)
    return img

def build_frame(i):
    t = i/FPS
    if t < CALL_END:
        img = ken_burns(t)
        draw_hook_flash(img, t)
        draw_caption(img, t)
    else:
        img = cta_card(t)
    return img

def main():
    if os.path.exists(FRAMES): shutil.rmtree(FRAMES)
    os.makedirs(FRAMES)
    n = int(TOTAL*FPS)
    print(f"Rendering {n} frames...")
    for i in range(n):
        build_frame(i).save(os.path.join(FRAMES, f"{i:05d}.png"))
        if i % (FPS*5) == 0: print(f"  {i/FPS:.0f}s / {TOTAL:.0f}s")
    print("Encoding...")
    subprocess.run([
        "ffmpeg","-y","-framerate",str(FPS),
        "-i",os.path.join(FRAMES,"%05d.png"),
        "-i",AUDIO,
        "-c:v","libx264","-preset","medium","-crf","19",
        "-c:a","aac","-b:a","192k","-pix_fmt","yuv420p","-shortest",OUT
    ], check=True)
    shutil.rmtree(FRAMES)
    print(f"\nDone → {OUT}")

if __name__ == "__main__":
    main()
