"""Artes do mascote: recorta poses novas e gera os quadros da abertura.

    python scripts/mascote.py recortar <imagem> <nome> [--rosa] [--tamanho 520]
        Tira o fundo claro (e a sombra do chão), suaviza a borda sem halo, apaga pedaços soltos e salva
        public/mascote/azul/<nome>.webp e public/mascote/rosa/<nome>.webp (a outra cor sai por troca de matiz).
        --rosa: a imagem veio com a porquinha rosa (a azul é que sai por troca de cor).

    python scripts/mascote.py abertura
        Gera public/mascote/{azul,rosa}/abertura-{pensa,uau,feliz}.webp a partir dos rostos, todos alinhados
        pela moeda da cabeça (a cena da abertura troca de pose sem a moeda pular). Imprime onde a moeda ficou:
        esses números vão em --cx/--cy/--coin do .splash-stage (src/index.css).

Só usa Pillow (pip install pillow). Funciona melhor com a pose sozinha, em fundo branco ou bem claro e liso.
Depois de trocar artes, suba ART_VERSION em src/components/Pig.tsx (o app guarda as artes em cache).
"""
import os
import sys
from collections import deque

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'mascote')


def lum(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]


def is_bgish(p, strict, glow=False):
    """Fundo, degradê do cartão, brilho e sombra clara do chão: claro e (quase) sem tinta forte."""
    r, g, b = p[:3]
    if glow and ((r > 205 and b > 120 and r - g > 25) or (g > 185 and g - r > 12 and b < g)):
        return True  # brilho rosa (modo rígido) ou verde (modo suave) do cartão
    mn, mx = min(r, g, b), max(r, g, b)
    if strict:  # cenas com vidro/papel: só o que é bem claro e acinzentado/azulado-claro
        return mn > 196 and mx - mn < 34
    return mn > 168 and lum(p) > 205


def matte(tile, strict=False, ratio=0.012, keep_border=False, glow=False, seed_bottom=True):
    tile = tile.convert('RGB')
    w, h = tile.size
    px = tile.load()
    # cor do fundo: mediana da borda
    border = [px[x, 0] for x in range(w)] + [px[x, h - 1] for x in range(w)] + [px[0, y] for y in range(h)] + [px[w - 1, y] for y in range(h)]
    bg = tuple(sorted(c[i] for c in border)[len(border) // 2] for i in range(3))

    # 1) inunda a partir da borda pelo que parece fundo
    out = [[False] * w for _ in range(h)]
    q = deque()
    for x in range(w):
        for y in ((0, h - 1) if seed_bottom else (0,)):
            if is_bgish(px[x, y], strict, glow) and not out[y][x]:
                out[y][x] = True; q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_bgish(px[x, y], strict, glow) and not out[y][x]:
                out[y][x] = True; q.append((x, y))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not out[ny][nx] and is_bgish(px[nx, ny], strict, glow):
                out[ny][nx] = True; q.append((nx, ny))

    # 2) alfa: dentro = 255; na faixa da borda (2 px), alfa pela distância ao fundo e cor "descontaminada"
    res = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    rp = res.load()
    lb = lum(bg)
    for y in range(h):
        for x in range(w):
            if out[y][x]:
                continue
            near = False
            for dy in (-2, -1, 0, 1, 2):
                for dx in (-2, -1, 0, 1, 2):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and out[ny][nx]:
                        near = True; break
                if near:
                    break
            p = px[x, y]
            if not near:
                rp[x, y] = (*p, 255); continue
            # quanto o pixel se afasta do fundo (cor e brilho)
            d = max(abs(p[0] - bg[0]), abs(p[1] - bg[1]), abs(p[2] - bg[2]), (lb - lum(p)) * 1.2)
            a = max(0.0, min(1.0, (d - 18) / 110))
            if a < 0.08:
                continue
            c = tuple(max(0, min(255, int(round((p[i] - (1 - a) * bg[i]) / a)))) for i in range(3))
            rp[x, y] = (*c, int(a * 255))

    # 3) pedaços: fica o maior, e o que não for minúsculo nem encostar na borda do recorte
    al = res.getchannel('A').load()
    seen = [[False] * w for _ in range(h)]
    comps = []
    for y in range(h):
        for x in range(w):
            if al[x, y] > 40 and not seen[y][x]:
                pts, touch = [], False
                st = [(x, y)]; seen[y][x] = True
                while st:
                    cx, cy = st.pop(); pts.append((cx, cy))
                    if cx in (0, w - 1) or cy in (0, h - 1):
                        touch = True
                    for nx in (cx - 1, cx, cx + 1):
                        for ny in (cy - 1, cy, cy + 1):
                            if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and al[nx, ny] > 40:
                                seen[ny][nx] = True; st.append((nx, ny))
                comps.append((pts, touch))
    if comps:
        big = max(len(c[0]) for c in comps)
        keep = [False] * len(comps)
        for i, (pts, touch) in enumerate(comps):
            keep[i] = len(pts) == big or (len(pts) >= big * ratio and (keep_border or not touch))
        mask = Image.new('L', (w, h), 0)
        mp = mask.load()
        for i, (pts, _) in enumerate(comps):
            if keep[i]:
                for x, y in pts:
                    mp[x, y] = 255
        # pixels fracos (alfa <= 40) colados num pedaço mantido continuam; o resto some
        grow = mask.filter(ImageFilter.MaxFilter(5))
        a2 = Image.composite(res.getchannel('A'), Image.new('L', (w, h), 0), grow)
        res.putalpha(a2)
    bbox = res.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    return res.crop(bbox) if bbox else res


def hsv_map(im, fn):
    rgb, alpha = im.convert('RGB'), im.getchannel('A')
    hsv = rgb.convert('HSV')
    hp = hsv.load()
    w, h = hsv.size
    for y in range(h):
        for x in range(w):
            hp[x, y] = fn(*hp[x, y])
    out = hsv.convert('RGB')
    out.putalpha(alpha)
    return out


BLUE_H = 155  # matiz do porquinho azul (0-255)
PINK_H = 242


def to_pink(im):
    def f(H, S, V):
        if 128 <= H <= 180 and S > 45:
            return (PINK_H, int(S * 0.6), min(255, int(V * 1.12 + 12)))
        return (H, S, V)
    return hsv_map(im, f)


def to_blue(im):
    """Porco rosa vira azul: só a pele rosa (matiz 226-252) e o contorno dela; vermelho da bandana e marrom ficam."""
    def f(H, S, V):
        if 226 <= H <= 252 and S > 30:
            if V >= 110 and S < 170:
                return (151, min(255, int(S * 1.2 + 55)), min(255, int(V * 0.97)))
            if V < 140:
                return (156, S, V)  # contorno escuro da pele/roupa rosa
        return (H, S, V)
    return hsv_map(im, f)


def coin(im):
    """Centro e raio da moeda dourada no alto da cabeça: o pedaço amarelo ligado ao ponto amarelo mais alto
    (os olhos de estrela e o brilho do "uau" também são amarelos)."""
    px, a = im.convert('RGB').load(), im.getchannel('A').load()
    w, h = im.size

    def gold(x, y):
        r, g, b = px[x, y]
        return a[x, y] > 120 and r > 170 and g > 110 and b < 140 and r - b > 70

    # a moeda fica no alto e no meio; o brilho do "uau" fica no canto e os olhos de estrela, mais embaixo
    pts = [(x, y) for y in range(int(h * 0.24)) for x in range(int(w * 0.25), int(w * 0.75)) if gold(x, y)]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (max(xs) - min(xs)) / 2)


def cut(path, name, pink_source=False, size=520):
    im = matte(Image.open(path))
    im.thumbnail((size, size), Image.LANCZOS)
    azul, rosa = (to_blue(im), im) if pink_source else (im, to_pink(im))
    for color, v in (('azul', azul), ('rosa', rosa)):
        out = os.path.join(ROOT, color, f'{name}.webp')
        v.save(out, 'WEBP', quality=90, method=6)
        print(os.path.relpath(out), v.size)


def opening():
    poses = {'pensa': 'rosto-pensativo', 'uau': 'rosto-animado', 'feliz': 'rosto-feliz'}
    for color in ('azul', 'rosa'):
        ims = {k: Image.open(os.path.join(ROOT, color, f'{v}.webp')).convert('RGBA') for k, v in poses.items()}
        # as artes de rosto são pequenas: dobra com Lanczos e um pouco de nitidez (a abertura mostra grande)
        ims = {k: im.resize((im.width * 2, im.height * 2), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.2, 60, 2)) for k, im in ims.items()}
        cs = {k: coin(im) for k, im in ims.items()}
        left = max(c[0] for c in cs.values())
        top = max(c[1] for c in cs.values())
        right = max(im.width - cs[k][0] for k, im in ims.items())
        bottom = max(im.height - cs[k][1] for k, im in ims.items())
        W, H = int(left + right) + 2, int(top + bottom) + 2
        for k, im in ims.items():
            canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            canvas.alpha_composite(im, (int(round(left - cs[k][0])), int(round(top - cs[k][1]))))
            canvas.save(os.path.join(ROOT, color, f'abertura-{k}.webp'), 'WEBP', quality=88, method=6)
        r = sum(c[2] for c in cs.values()) / 3
        print(f'{color}: {W}x{H}  --cx: {100 * left / W:.1f}%  --cy: {100 * top / H:.1f}%  --coin: {200 * r / W:.1f}%  aspect-ratio: {W} / {H}')


if __name__ == '__main__':
    args = sys.argv[1:]
    if args[:1] == ['recortar'] and len(args) >= 3:
        size = int(args[args.index('--tamanho') + 1]) if '--tamanho' in args else 520
        cut(args[1], args[2], pink_source='--rosa' in args, size=size)
    elif args[:1] == ['abertura']:
        opening()
    else:
        print(__doc__)
        sys.exit(1)
