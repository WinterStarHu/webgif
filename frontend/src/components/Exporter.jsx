import React, { useState } from 'react'
import { encodeGif } from '../lib/api'

export default function Exporter({ data, fps, onBack }) {
  const { eff, seq, speed } = data
  const [outWidth, setOutWidth] = useState(0)
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [resultUrl, setResultUrl] = useState(null)
  const [resultMeta, setResultMeta] = useState('')
  const [error, setError] = useState('')

  const doExport = async () => {
    setError(''); setResultUrl(null); setBusy(true); setProgress(0)
    try {
      const blob = await encodeGif(seq.frames, seq.delays, {
        outWidth,
        onProgress: setProgress,
      })
      const url = URL.createObjectURL(blob)
      setResultUrl(url)
      const kb = blob.size / 1024
      const sizeStr = kb > 1024 ? (kb / 1024).toFixed(2) + ' MB' : kb.toFixed(0) + ' KB'
      const dur = (seq.frames.length * (seq.delays[0] || 100) / 1000).toFixed(2)
      setResultMeta(`${sizeStr} · ${seq.frames.length} 帧 · ${dur}s · ${seq.fpsEff}fps`)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel">
      <div className="row">
        <label>输出宽度
          <select value={outWidth} onChange={e => setOutWidth(+e.target.value)} disabled={busy}>
            <option value={0}>自适应</option>
            <option value={640}>640px</option>
            <option value={480}>480px</option>
            <option value={320}>320px</option>
          </select>
        </label>
        <button className="primary" onClick={doExport} disabled={busy}>开始导出 GIF</button>
        <button className="ghost" onClick={onBack} disabled={busy}>← 回到编辑</button>
      </div>

      {busy && (
        <div className="progress">
          <div className="progress-bar"><div style={{ width: `${progress * 100}%` }} /></div>
          <div className="progress-text">编码中… {Math.round(progress * 100)}%</div>
        </div>
      )}

      {error && <div className="error">导出失败: {error}</div>}

      {resultUrl && (
        <div className="result">
          <img src={resultUrl} alt="GIF 预览" />
          <div className="result-meta">{resultMeta}</div>
          <a className="primary" href={resultUrl} download={`recording-${Date.now()}.gif`}>⬇ 下载 GIF</a>
        </div>
      )}

      <div className="hint" style={{ marginTop: 14 }}>
        导出 {seq.frames.length} 帧 · 变速 {speed}x · 有效 {seq.fpsEff}fps
      </div>
    </div>
  )
}
