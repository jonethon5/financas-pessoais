// Fotos: tudo é reduzido no próprio aparelho antes de enviar (perfil ~512px, prints até 1600px).

export function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível abrir essa imagem. Tente outra (JPG ou PNG).'))
    }
    img.src = url
  })
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível preparar a imagem.'))), type, quality)
  })
}

/** Medidas para caber em maxSide mantendo a proporção (nunca aumenta). */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Reduz uma imagem (ex.: print para a sugestão) e devolve JPEG. */
export async function shrinkImage(file: Blob, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const img = await loadImage(file)
  const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, maxSide)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)
  URL.revokeObjectURL(img.src)
  return canvasToBlob(canvas, 'image/jpeg', quality)
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
