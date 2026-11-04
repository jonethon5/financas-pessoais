import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { canvasToBlob, loadImage } from '../lib/image'
import { Sheet } from './Sheet'
import { Button, ErrorBox } from './ui'

const STAGE = 288 // tamanho do quadro na tela (px)
const OUTPUT = 512 // tamanho da foto salva (px)
const MAX_ZOOM = 4

type Point = { x: number; y: number }

/**
 * Recorte quadrado da foto (o círculo mostra como ela aparece no perfil).
 * Arrastar move, pinçar ou usar o controle aproxima. Sai uma foto de 512×512 em JPEG.
 */
export function PhotoCropper({ file, onCancel, onDone }: { file: File | null; onCancel: () => void; onDone: (image: Blob) => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const pointers = useRef(new Map<number, Point>())
  const pinch = useRef<{ dist: number; zoom: number } | null>(null)

  useEffect(() => {
    if (!file) return
    let url: string | null = null
    let alive = true
    setImg(null)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setError(null)
    loadImage(file)
      .then((loaded) => {
        url = loaded.src
        if (alive) setImg(loaded)
      })
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [file])

  const base = img ? STAGE / Math.min(img.naturalWidth, img.naturalHeight) : 1
  const scale = base * zoom
  const width = img ? img.naturalWidth * scale : 0
  const height = img ? img.naturalHeight * scale : 0

  /** A foto sempre cobre o quadro inteiro (sem bordas vazias). */
  function clamp(o: Point, s = scale): Point {
    if (!img) return o
    const maxX = Math.max(0, (img.naturalWidth * s - STAGE) / 2)
    const maxY = Math.max(0, (img.naturalHeight * s - STAGE) / 2)
    return { x: Math.max(-maxX, Math.min(maxX, o.x)), y: Math.max(-maxY, Math.min(maxY, o.y)) }
  }

  function changeZoom(z: number) {
    const next = Math.max(1, Math.min(MAX_ZOOM, z))
    setZoom(next)
    setOffset((o) => clamp(o, base * next))
  }

  function onPointerDown(e: PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom }
    }
  }

  function onPointerMove(e: PointerEvent) {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const cur = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, cur)
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      changeZoom((pinch.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.dist)
    } else if (pointers.current.size === 1) {
      setOffset((o) => clamp({ x: o.x + cur.x - prev.x, y: o.y + cur.y - prev.y }))
    }
  }

  function onPointerUp(e: PointerEvent) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }

  async function confirm() {
    if (!img) return
    setBusy(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT
      canvas.height = OUTPUT
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingQuality = 'high'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, OUTPUT, OUTPUT)
      const f = OUTPUT / STAGE
      ctx.drawImage(img, (STAGE / 2 + offset.x - width / 2) * f, (STAGE / 2 + offset.y - height / 2) * f, width * f, height * f)
      onDone(await canvasToBlob(canvas, 'image/jpeg', 0.86))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={Boolean(file)} onClose={onCancel} title="Ajustar foto">
      {error ? (
        <ErrorBox message={error} />
      ) : (
        <div className="flex flex-col items-center gap-5">
          <div
            className="relative touch-none overflow-hidden rounded-[1.25rem] bg-ink select-none"
            style={{ width: STAGE, height: STAGE }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={(e) => changeZoom(zoom - e.deltaY / 500)}
          >
            {img && (
              <img
                src={img.src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none"
                style={{ width, height, left: STAGE / 2 + offset.x - width / 2, top: STAGE / 2 + offset.y - height / 2 }}
              />
            )}
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgb(15_36_51/0.5)]" />
          </div>
          <label className="w-full px-2">
            <span className="sr-only">Aproximar</span>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => changeZoom(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </label>
          <p className="-mt-2 text-center text-[0.875rem] text-muted">Arraste para posicionar e use o controle para aproximar.</p>
        </div>
      )}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={confirm} loading={busy} disabled={!img}>
          Usar foto
        </Button>
      </div>
    </Sheet>
  )
}
