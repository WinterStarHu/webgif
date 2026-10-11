// sequence.js — 变速重采样算法（移植自 v1 store.js exportSequence）
// 保证加速后有效帧率不撞浏览器 20ms 最小渲染延迟，保持流畅
//
// 输入：frames（选区内未删除的帧，每帧含 blob 时间戳）、fps、speed
// 输出：{ frames:[{blob, w, h}], delays:[ms...], fpsEff }
//
// 算法：
//   baseDelay = 1000/fps
//   d_ms = baseDelay / speed
//   若 d_ms >= 20ms → 不抽帧，每帧 delay=d_ms（最流畅）
//   否则 → 抽帧到 M = ceil(T/20)，T=N*baseDelay/speed，每帧 delay=T/M，确保 ≥20ms

export function exportSequence(effectiveFrames, fps, speed) {
  const N = effectiveFrames.length
  if (N === 0) return { frames: [], delays: [], fpsEff: 0 }

  const baseDelay = 1000 / fps
  let d_ms = baseDelay / speed
  let kept = effectiveFrames

  if (d_ms < 20) {
    const T_ms = (N * baseDelay) / speed
    const M = Math.max(1, Math.round(T_ms / 20))
    kept = []
    for (let i = 0; i < M; i++) {
      const idx = M === 1 ? 0 : Math.round((i * (N - 1)) / (M - 1))
      kept.push(effectiveFrames[idx])
    }
    d_ms = T_ms / M
  }

  const delay = Math.max(20, Math.round(d_ms))
  const fpsEff = Math.round(1000 / delay)
  const delays = new Array(kept.length).fill(delay)
  return { frames: kept, delays, fpsEff }
}

// 从原始录制帧（含 blob）生成 effectiveFrames：应用选区 + 删除标记
export function effectiveFrames(frames, selStart, selEnd, deleted) {
  const out = []
  for (let i = selStart; i <= selEnd; i++) {
    if (!deleted.has(i) && frames[i]) out.push(frames[i])
  }
  return out
}
