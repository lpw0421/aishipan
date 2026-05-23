/**
 * 图片压缩工具（Canvas 实现，无需额外依赖）
 *
 * 将上传的图片限制在 maxWidth/maxHeight 范围内，
 * 并控制 JPEG 质量为 0.8，减少文件体积。
 */

const MAX_WIDTH = 1920
const MAX_HEIGHT = 1920
const QUALITY = 0.8

export function compressImage(file) {
  return new Promise((resolve, reject) => {
    // 非图片文件直接返回原始文件
    if (!file.type.startsWith('image/')) {
      return resolve(file)
    }

    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img

      // 等比缩放至限制内
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      // 无需缩放则返回原文件
      if (width === img.naturalWidth && height === img.naturalHeight && file.size < 500 * 1024) {
        return resolve(file)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(file)
          const compressed = new File([blob], file.name, { type: 'image/jpeg' })
          resolve(compressed)
        },
        'image/jpeg',
        QUALITY
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file) // 出错时返回原文件
    }

    img.src = url
  })
}
