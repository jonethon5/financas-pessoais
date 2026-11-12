"""Monta as imagens do README a partir dos prints (npm run vitrine): mosaico das telas e GIF passando por elas.
Uso: python scripts/vitrine-gif.py <pasta-dos-prints> docs/img   (precisa do Pillow: pip install pillow)"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
files = sorted(f for f in os.listdir(src) if f.endswith('.png'))


def phone(name, w=300):
    """Print com cantos arredondados, no formato da tela do celular."""
    im = Image.open(os.path.join(src, name)).convert('RGB')
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im = im.crop((0, 0, w, min(round(w * 2.16), im.height)))
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius=28, fill=255)
    out = Image.new('RGBA', im.size)
    out.paste(im, (0, 0), mask)
    return out


# Mosaico com 5 telas lado a lado
pick = [f for f in ['02-inicio.png', '03-lancar.png', '04-graficos.png', '06-lojinha.png', '07-bancos.png'] if f in files]
phones = [phone(f) for f in pick]
gap, pad = 28, 40
W = pad * 2 + sum(p.width for p in phones) + gap * (len(phones) - 1)
H = pad * 2 + max(p.height for p in phones)
bg = Image.new('RGBA', (W, H), (234, 241, 254, 255))
x = pad
for p in phones:
    shadow = Image.new('RGBA', (p.width + 40, p.height + 40), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((20, 26, p.width + 20, p.height + 20), radius=30, fill=(15, 36, 51, 70))
    bg.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(12)), (x - 20, pad - 20))
    bg.alpha_composite(p, (x, pad))
    x += p.width + gap
bg.convert('RGB').save(os.path.join(dst, 'telas.png'), optimize=True)

# GIF passando por todas as telas
frames = []
for f in files:
    p = phone(f, 320)
    canvas = Image.new('RGB', (p.width + 40, p.height + 40), (234, 241, 254))
    canvas.paste(p, (20, 20), p)
    frames.append(canvas.convert('P', palette=Image.ADAPTIVE, colors=128))
frames[0].save(os.path.join(dst, 'demo.gif'), save_all=True, append_images=frames[1:], duration=1600, loop=0, optimize=True)
print(f'ok: {len(phones)} telas no mosaico, {len(frames)} quadros no GIF')
