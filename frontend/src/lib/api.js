// api.js — 调用后端 /api/encode
// frames: [{blob, w, h}], delays:[ms...], width, loop
// 返回 Blob(image/gif)
export async function encodeGif(frames, delays, { width = 0, loop = 0, onProgress } = {}) {
  if (!frames.length) throw new Error('无可导出帧')

  const fd = new FormData()
  frames.forEach((f, i) => {
    fd.append('frames', f.blob, `frame_${i}.jpg`)
  })
  fd.append('json', JSON.stringify({ delays, width, loop }))

  const resp = await fetch('/api/encode', { method: 'POST', body: fd })
  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`
    try { const j = await resp.json(); msg = j.error || msg } catch {}
    throw new Error(msg)
  }
  // 进度（简单：fetch 无上传进度，这里用一个假进度 + 完成回调）
  if (onProgress) onProgress(0.5)
  const blob = await resp.blob()
  if (onProgress) onProgress(1)
  return blob
}
