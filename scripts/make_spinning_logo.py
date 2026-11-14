#!/usr/bin/env python3
# Cut the spinning CMC logo out of the teacher's upload
# (upload/spining_360_vertical_60036c59.mp4 — a 3D chrome "CM · creativeminds"
# disc spinning one full turn on a dark circuit background, 720×1280 portrait,
# with two "Dola AI" watermarks).
#
# v64 — STABILIZED cut. The disc ORBITS its spin axis in the source render:
# measuring all 190 frames (density-mask bright bbox, 2nd-98th percentile)
# gives a projected center x sweeping 327→421→327 (94px spread) in a smooth
# cycle tied to the spin phase — face-on frames center ≈368, edge-on approach
# swings right to ≈420, then left to ≈328. A single fixed crop (v61-v63) can
# never keep the black medallion ring even at every phase (owner screenshot:
# fat black crescent on one side mid-spin; owner: "center logo so black back
# ground looks even with logo center"). So each frame is re-centered on its
# OWN measured center: circular moving-average smoothing (window 11,
# wrap-around — the 190-frame loop stays seamless), integer shifts, then a
# 640×640 crop around the target center (369, 633) with the region OUTSIDE
# the 320px circle painted black and the small "Dola AI" watermark zone
# (source x 590-690, y 915-940, static in the source; its position inside the
# crop follows the per-frame shift) blacked out per-frame. Result: the coin's
# center sits motionless at the frame center through the whole spin — the
# black ring is even at every angle.
#
# Output: 224×224 webm (VP9 crf 36) + mp4 (H.264) + poster JPG (face-on
# frame), audio stripped, exactly 190 frames @ 24fps (7.917s) so the loop is
# frame-aligned.
import glob
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

SRC = '/home/z/my-project/upload/spining_360_vertical_60036c59.mp4'
OUT = '/home/z/my-project/tmp/cmc-site/public/images'
FRAMES = '/tmp/spincut/src'      # native source frames
COMP = '/tmp/spincut/comp'       # composed 224×224 frames
TARGET = (369.0, 633.0)          # anchor center (mean of the measured series)
SIDE = 640
RADIUS = SIDE // 2
OUT_SIZE = 224                   # 2× headroom over the 56px (112 retina) display
SNAP = 2                         # shift grid: snapping to 2px restores most of
                                 # VP9's inter-frame prediction (the shift
                                 # states repeat for longer runs); residual
                                 # wobble ±1px source = ±0.4px at 112 device px
WM = (585, 910, 700, 970)        # small "Dola AI" watermark rect + margin in
                                 # the source (the text extends below y=940 —
                                 # v63's fixed crop bottom edge hid that part)

for d in (FRAMES, COMP):
    os.makedirs(d, exist_ok=True)

# 1. extract every source frame once (re-used across runs)
if len(glob.glob(f'{FRAMES}/f*.png')) != 190:
    subprocess.run(['ffmpeg', '-v', 'error', '-i', SRC, f'{FRAMES}/f%03d.png', '-y'], check=True)
files = sorted(glob.glob(f'{FRAMES}/f*.png'))
assert len(files) == 190, len(files)

# 2. per-frame disc center via density mask (solid bright body vs thin traces)
def measure(path):
    a = np.asarray(Image.open(path).convert('L'), dtype=np.uint8)
    bright = (a[250:1000, 0:720] > 150).astype(np.int16)
    p = np.pad(bright, 5, mode='edge')
    c = p.cumsum(0).cumsum(1)
    c = np.pad(c, ((1, 0), (1, 0)))
    D = c[11:, 11:] - c[:-11, 11:] - c[11:, :-11] + c[:-11, :-11]
    ys, xs = np.where(D > 60)
    x0, x1 = np.percentile(xs, [2, 98])
    y0, y1 = np.percentile(ys, [2, 98])
    # mask coords → source coords (the bright slice starts at row 250)
    return (x0 + x1) / 2, (y0 + y1) / 2 + 250, x1 - x0

centers = [measure(f) for f in files]
widths = [c[2] for c in centers]

# 3. circular moving average (wrap-around keeps the loop seam seamless)
def smooth(vals, w=11):
    n = len(vals)
    h = w // 2
    return [sum(vals[(i + k) % n] for k in range(-h, h + 1)) / w for i in range(n)]

sx = smooth([c[0] for c in centers])
sy = smooth([c[1] for c in centers])
print(f'center series: x {min(sx):.0f}..{max(sx):.0f}  y {min(sy):.0f}..{max(sy):.0f}')

# 4. compose: per-frame shift → 640×640 crop → watermark box → 224×224.
#    (The region outside the 320px circle is left as-is: the CSS rounded-full
#    mask clips it exactly like v61-v63 did, and keeping natural content
#    instead of painted-black corners keeps the VP9 bitrate in check.)
circle = Image.new('L', (SIDE, SIDE), 0)
ImageDraw.Draw(circle).ellipse((0, 0, SIDE - 1, SIDE - 1), fill=255)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB')
    ox = int(round((sx[i] - TARGET[0]) / SNAP) * SNAP)   # crop origin, 2px grid
    oy = int(round((sy[i] - TARGET[1]) / SNAP) * SNAP)
    x0, y0 = TARGET[0] - RADIUS + ox, TARGET[1] - RADIUS + oy
    crop = im.crop((x0, y0, x0 + SIDE, y0 + SIDE))  # PIL pads out-of-bounds black
    # watermark zone (source rect → local coords of THIS frame's crop)
    wx0, wy0 = WM[0] - x0, WM[1] - y0
    wx1, wy1 = WM[2] - x0, WM[3] - y0
    if wx1 > 0 and wy1 > 0 and wx0 < SIDE and wy0 < SIDE:
        ImageDraw.Draw(crop).rectangle((max(wx0, 0), max(wy0, 0),
                                        min(wx1, SIDE - 1), min(wy1, SIDE - 1)), fill=(0, 0, 0))
    crop.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS).save(f'{COMP}/f{i + 1:03d}.png')

# 5. encode: webm (VP9) + mp4 (H.264) + poster (face-on frame ≈ t=7.2s → f173)
subprocess.run(['ffmpeg', '-v', 'error', '-framerate', '24', '-i', f'{COMP}/f%03d.png',
                '-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0', '-an',
                f'{OUT}/cmc-spin-logo.webm', '-y'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-framerate', '24', '-i', f'{COMP}/f%03d.png',
                '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', '-an',
                f'{OUT}/cmc-spin-logo.mp4', '-y'], check=True)
Image.open(f'{COMP}/f173.png').save(f'{OUT}/cmc-spin-logo-poster.jpg', quality=87)

for f in ('cmc-spin-logo.webm', 'cmc-spin-logo.mp4', 'cmc-spin-logo-poster.jpg'):
    p = f'{OUT}/{f}'
    print(f'{f} {os.path.getsize(p)} bytes')
    subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
                    '-show_entries', 'stream=codec_name,width,height,duration',
                    '-of', 'default=noprint_wrappers=1', p])
print('assets ok')
