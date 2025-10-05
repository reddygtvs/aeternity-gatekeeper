import QRCode from 'qrcode'

export async function makeQR(text: string) {
  return await QRCode.toDataURL(text, { width: 220 })
}
