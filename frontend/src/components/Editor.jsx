import React, { useState, useEffect, useRef, useCallback } from 'react'
import { effectiveFrames, exportSequence } from '../lib/sequence'

export default function Editor({ frames, fps, onBack, onExport }) {
  const [selStart, setSelStart] = useState(0)
  const [selEnd, setSelEnd] = useState(frames.length - 1)
  const [deleted, setDeleted] = useState(new Set())
  const [speed, setSpeed] = useState(1)
  const [thumbs, setThumbs] = useState([])
  const [playing, setPlaying] = useState(false)
  const [previewIdx, setPreviewIdx] = useState(0)
  const canvasRef = useRef(null)
  const thumbRefs = useRef([])
  const playTimerRef = useRef(null)
  const draggingRef = useRef(null)

  // 生成缩略图 URL
  useEffect(() => {
    const urls = frames.map(f => URL.createObjectURL(f.blob))
    setThumbs(urls)
    return () => urls.forEach(u => URL.revokeObjectURL(u))
  }, [frames])

  useEffect(() => {
    setSelStart(0); setSelEnd(frames.length - 1)
    setDeleted(new Set())
    setPreviewIdx(0)
  }, [frames])

  // 绘制预览帧
  const drawFrame = useCallback((idx) => {
    const cv = canvasRef.current
    if (!cv || !frames[idx]) return
    const ctx = cv.getContext('2d')
    const img = new Image()
    img.onload = () => {
      cv.width = frames[idx].w
      cv.height = frames[idx].h
      ctx.clearRect(0, 0, cv.width, cv.height)
      ctx.drawImage(img, 0, 0)
    }
    img.src = thumbs[idx] || URL.createObjectURL(frames[idx].blob)
  }, [frames, thumbs])

  useEffect(() => { if (frames.length) drawFrame(0) }, [frames, drawFrame])

  const deletedSet = deleted
  const eff = effectiveFrames(frames, selStart, selEnd, deletedSet)
  const seq = exportSequence(eff, fps, speed)

  // 预览播放
  const stopPreview = useCallback(() => {
    if (playTimerRef.current) clearInterval(playTimerRef.current)
    playTimerRef.current = null
    setPlaying(false)
  }, [])

  const togglePreview = () => {
    if (playing) { stopPreview(); return }
    if (!seq.frames.length) return
    stopPreview()
    setPlaying(true)
    let i = 0
    setPreviewIdx(seq.frames[0] ? 0 : 0)
    const step = () => {
      const f = seq.frames[i]
      if (!f) return
      drawFrame(frames.indexOf(f))
      i = (i + 1) % seq.frames.length
    }
    step()
    const delay = Math.max(20, seq.delays[0] || 100)
    playTimerRef.current = setInterval(step, delay)
  }

  useEffect(() => () => stopPreview(), [stopPreview])

  // 变速时重启预览
  useEffect(() => { if (playing) { stopPreview(); togglePreview() } }, [speed, selStart, selEnd, deleted])
  // eslint-disable-next-line

  const toggleDelete = (i) => {
    setDeleted(prev => {
      const n = new Set(prev)
      n.has(i) ? n.delete(i) : n.add(i)
      return n
    })
  }

  const reset = () => {
    setDeleted(new Set())
    setSelStart(0)
    setSelEnd(frames.length - 1)
    setSpeed(1)
    stopPreview()
  }

  // 拖动手柄
  const startDrag = (which) => (e) => {
    e.preventDefault()
    draggingRef.current = which
  }
  useEffect(() => {
    const move = (e) => {
      if (!draggingRef.current) return
      const track = document.getElementById('tlTrack')
      if (!track) return
      const rect = track.getBoundingClientRect()
      const x = e.clientX - rect.left + track.scrollLeft
      const tw = 90
      let idx = Math.round(x / tw)
      idx = Math.max(0, Math.min(frames.length - 1, idx))
      if (draggingRef.current === 'left') setSelStart(Math.min(idx, selEnd))
      else setSelEnd(Math.max(idx, selStart))
    }
    const up = () => { draggingRef.current = null }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [selEnd, selStart, frames.length])

  const selInfo = `选中 ${eff.length} 帧（区间 ${selStart}–${selEnd} / 共 ${frames.length}）· 变速 ${speed}x → 导出 ${seq.frames.length} 帧 @ ${seq.fpsEff}fps`

  return (
    <div className="panel">
      <div className="preview-wrap">
        <canvas ref={canvasRef} />
        {!playing && <div className="play-overlay">▶</div>}
      </div>

      <div className="edit-controls">
        <div className="row">
          <label>变速倍率
            <select value={speed} onChange={e => setSpeed(+e.target.value)}>
              <option value={0.5}>0.5x 慢放</option>
              <option value={1}>1x 原速</option>
              <option value={2}>2x 加速</option>
              <option value={3}>3x</option>
              <option value={4}>4x</option>
            </select>
          </label>
          <button onClick={togglePreview}>{playing ? '⏸ 停止预览' : '▶ 预览'}</button>
          <button onClick={reset}>↺ 重置</button>
          <button className="ghost" onClick={() => { stopPreview(); onBack() }}>← 重新录制</button>
          <button className="primary" onClick={() => { stopPreview(); onExport({ eff, seq, speed }) }}>去导出 →</button>
        </div>
        <div className="hint">拖动两端手柄裁剪片段 · 点缩略图删除/恢复单帧</div>
      </div>

      <div className="timeline-wrap">
        <div className="timeline">
          <div className="timeline-track" id="tlTrack">
            {thumbs.map((url, i) => (
              <div
                key={i}
                className={`thumb ${deleted.has(i) ? 'deleted' : ''} ${i >= selStart && i <= selEnd ? 'sel' : ''}`}
                style={{ width: '88px' }}
                onClick={() => toggleDelete(i)}
              >
                <img src={url} alt="" />
                <span className="idx">{i}</span>
              </div>
            ))}
            <div className="selection" style={{ left: selStart * 90, width: (selEnd - selStart + 1) * 90 }}>
              <div className="handle left" onMouseDown={startDrag('left')} />
              <div className="handle right" onMouseDown={startDrag('right')} />
            </div>
          </div>
        </div>
        <div className="timeline-info">{selInfo}</div>
      </div>
    </div>
  )
}
