#!/usr/bin/env python3
"""CTA end card for the Flow UGC ad. 9:16, brand-matched to the poster."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
POSTER = os.path.join(HERE, "poster.jpeg")
OUT = os.path.join(HERE, "cta-endcard.png")

W, H = 1080, 1920
PURPLE = (99, 78, 255)
WHITE = (255, 255, 255)
MUTED = (190, 200, 218)

def font(size):
    for p in ["/System/Library/Fonts/Helvetica.ttc",
              "/Library/Fonts/Arial Bold.ttf"]:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except: pass
    return ImageFont.load_default()

F_BIG  = font(96)
F_BTN  = font(48)
F_SUB  = font(34)
F_URL  = font(52)

# Background: blurred + darkened poster for brand cohesion
bg = Image.open(POSTER).convert("RGB").resize((W, int(W*1376/768)), Image.LANCZOS)
bg = bg.crop((0, 0, W, H)).filter(ImageFilter.GaussianBlur(14))
overlay = Image.new("RGBA", (W, H), (9, 13, 24, 232))
img = Image.alpha_composite(bg.convert("RGBA"), overlay).convert("RGB")
d = ImageDraw.Draw(img)

def center(y, text, f, fill=WHITE):
    b = d.textbbox((0,0), text, font=f)
    d.text(((W-b[2])//2, y), text, font=f, fill=fill)

# Brand wordmark
center(470, "PHONE PHOEBE", font(52), PURPLE)
center(620, "Never miss", F_BIG)
center(720, "a booking again.", F_BIG)

# CTA button
btn = "Try Phoebe FREE for 7 days"
bb = d.textbbox((0,0), btn, font=F_BTN)
bw, bh = bb[2]+100, 130
bx, by = (W-bw)//2, 980
d.rounded_rectangle((bx, by, bx+bw, by+bh), radius=65, fill=PURPLE)
d.text(((W-bb[2])//2, by+38), btn, font=F_BTN, fill=WHITE)

center(1160, "No card  ·  Keep your number  ·  Cancel any time", F_SUB, MUTED)
center(1320, "phonephoebe.co.uk", F_URL)

img.save(OUT)
print("Saved:", OUT)
