#!/usr/bin/env python3
"""
Builds a faceless phone-screen style video for Phoebe demo call.
9:16 vertical, chat bubbles appear in sync with audio.
"""

import os
import subprocess
import shutil
from PIL import Image, ImageDraw, ImageFont

# ── Config ──────────────────────────────────────────────────────────────────
W, H    = 1080, 1920
FPS     = 30
AUDIO   = os.path.join(os.path.dirname(__file__), "phoebe-demo-call.mp3")
FRAMES  = os.path.join(os.path.dirname(__file__), "frames")
OUT     = os.path.join(os.path.dirname(__file__), "phoebe-demo-call.mp4")

# Colors
BG          = (15, 23, 41)        # Navy
PHONE_BG    = (22, 33, 62)        # Slightly lighter navy
BUBBLE_US   = (45, 55, 72)        # Grey — customer
BUBBLE_PHB  = (99, 78, 255)       # Purple — Phoebe
TEXT_WHITE  = (255, 255, 255)
TEXT_MUTED  = (160, 174, 192)
DOT_GREEN   = (72, 199, 142)
TOPBAR_BG   = (26, 37, 70)

# ── Conversation ─────────────────────────────────────────────────────────────
# (start_sec, end_sec, speaker, text)
LINES = [
    (0.00,  3.00, "customer", "Hi, do you have any driving lessons free this week?"),
    (3.60,  9.87, "phoebe",   "Hi there! Yes, I've got Tuesday at 2pm or Thursday at 10am. Which suits you best?"),
    (10.47, 12.04, "customer", "Tuesday's perfect."),
    (12.64, 16.72, "phoebe",  "Lovely. Can I take your name and a contact number to confirm the booking?"),
    (17.32, 21.68, "customer", "It's Sam. 07700 900123."),
    (22.28, 30.95, "phoebe",  "Perfect, Sam. You're all booked in for Tuesday at 2pm. You'll get a text confirmation shortly!"),
    (31.55, 33.59, "customer", "No, that's great. Thank you!"),
    (34.19, 36.10, "phoebe",  "Brilliant. Speak soon. Bye!"),
]

TOTAL_SECS = 36.5

# ── Font loading ─────────────────────────────────────────────────────────────
def load_font(size, bold=False):
    candidates = [
        f"/System/Library/Fonts/{'SFPro-Bold' if bold else 'SFPro-Regular'}.ttf",
        f"/System/Library/Fonts/{'Helvetica Bold' if bold else 'Helvetica'}.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()

FONT_NAME   = load_font(28, bold=True)
FONT_TIME   = load_font(26)
FONT_BUBBLE = load_font(34)
FONT_LABEL  = load_font(24, bold=True)
FONT_BRAND  = load_font(38, bold=True)
FONT_SUB    = load_font(26)
FONT_LIVE   = load_font(24)

# ── Helpers ──────────────────────────────────────────────────────────────────
def wrap_text(text, font, max_width, draw):
    words = text.split()
    lines, line = [], ""
    for word in words:
        test = (line + " " + word).strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] <= max_width:
            line = test
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines

def rounded_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill)

def draw_bubble(draw, text, speaker, y_pos, img_width, font, label_font):
    is_phoebe   = speaker == "phoebe"
    bubble_col  = BUBBLE_PHB if is_phoebe else BUBBLE_US
    label_text  = "PHOEBE" if is_phoebe else "CUSTOMER"
    label_col   = (180, 160, 255) if is_phoebe else TEXT_MUTED
    pad         = 28
    max_bw      = int(img_width * 0.72)
    margin      = 60

    # Wrap text
    dummy = Image.new("RGB", (1, 1))
    dd = ImageDraw.Draw(dummy)
    lines = wrap_text(text, font, max_bw - pad * 2, dd)

    line_h  = font.getbbox("Ag")[3] + 8
    bub_h   = len(lines) * line_h + pad * 2
    bub_w   = min(max_bw, max(
        max(draw.textbbox((0,0), l, font=font)[2] for l in lines) + pad * 2,
        120
    ))

    x = img_width - margin - bub_w if is_phoebe else margin
    y = y_pos

    # Label
    draw.text((x, y - 28), label_text, font=label_font, fill=label_col)

    # Bubble
    rounded_rect(draw, (x, y, x + bub_w, y + bub_h), radius=22, fill=bubble_col)

    # Text
    ty = y + pad
    for line in lines:
        draw.text((x + pad, ty), line, font=font, fill=TEXT_WHITE)
        ty += line_h

    return y + bub_h + 48   # return next y position

# ── Frame builder ─────────────────────────────────────────────────────────────
def build_frame(t):
    img  = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    # ── Header bar ───────────────────────────────────────────────────────────
    draw.rectangle([0, 0, W, 110], fill=TOPBAR_BG)

    # Live dot + label
    draw.ellipse([44, 38, 72, 66], fill=DOT_GREEN)
    draw.text((86, 36), "Live call", font=FONT_NAME, fill=TEXT_WHITE)

    # Timer
    elapsed = int(t)
    timer_str = f"00:{elapsed:02d}"
    tb = draw.textbbox((0, 0), timer_str, font=FONT_TIME)
    draw.text((W - tb[2] - 44, 38), timer_str, font=FONT_TIME, fill=TEXT_MUTED)

    # Caller name
    name_str = "Sam · 07700 900123"
    nb = draw.textbbox((0, 0), name_str, font=FONT_LABEL)
    draw.text(((W - nb[2]) // 2, 40), name_str, font=FONT_LABEL, fill=TEXT_WHITE)

    # ── Conversation area ─────────────────────────────────────────────────────
    visible = [line for line in LINES if t >= line[0]]
    y_start = 160

    for start, end, speaker, text in visible:
        y_start = draw_bubble(draw, text, speaker, y_start, W, FONT_BUBBLE, FONT_LABEL)

    # ── Bottom branding bar ───────────────────────────────────────────────────
    bar_y = H - 160
    draw.rectangle([0, bar_y, W, H], fill=TOPBAR_BG)

    brand = "📞 Phone Phoebe"
    sub   = "AI receptionist · phonephoebe.co.uk"
    bb = draw.textbbox((0, 0), brand, font=FONT_BRAND)
    sb = draw.textbbox((0, 0), sub, font=FONT_SUB)
    draw.text(((W - bb[2]) // 2, bar_y + 24), brand, font=FONT_BRAND, fill=TEXT_WHITE)
    draw.text(((W - sb[2]) // 2, bar_y + 82), sub, font=FONT_SUB, fill=TEXT_MUTED)

    return img

# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    if os.path.exists(FRAMES):
        shutil.rmtree(FRAMES)
    os.makedirs(FRAMES)

    total_frames = int(TOTAL_SECS * FPS)
    print(f"Rendering {total_frames} frames at {FPS}fps ({TOTAL_SECS}s)...")

    for i in range(total_frames):
        t = i / FPS
        frame = build_frame(t)
        frame.save(os.path.join(FRAMES, f"{i:05d}.png"))
        if i % (FPS * 5) == 0:
            print(f"  {t:.1f}s / {TOTAL_SECS}s")

    print("Encoding video...")
    subprocess.run([
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", os.path.join(FRAMES, "%05d.png"),
        "-i", AUDIO,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-c:a", "aac",
        "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-shortest",
        OUT
    ], check=True)

    shutil.rmtree(FRAMES)
    print(f"\nDone! → {OUT}")

if __name__ == "__main__":
    main()
