export async function stylizeToDataURL(srcDataUrl: string, _name: string) {
  const img = await load(srcDataUrl)
  const c = document.createElement('canvas')
  const g = c.getContext('2d')!
  const W = 512,
    H = Math.round((512 * img.height) / img.width)
  c.width = W
  c.height = H
  g.drawImage(img, 0, 0, W, H)

  // quick edge + posterize
  const id = g.getImageData(0, 0, W, H)
  const d = id.data
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i],
      g1 = d[i + 1],
      b = d[i + 2]
    // posterize to 4 levels
    d[i] = (r >> 6) << 6
    d[i + 1] = (g1 >> 6) << 6
    d[i + 2] = (b >> 6) << 6
  }
  g.putImageData(id, 0, 0)
  return c.toDataURL('image/png')
}

function load(u: string) {
  return new Promise<HTMLImageElement>(res => {
    const i = new Image()
    i.onload = () => res(i)
    i.src = u
  })
}
