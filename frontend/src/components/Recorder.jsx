import React from 'react'

export default function Recorder({ r, onFinish }) {
  const estKB = r.frames.reduce((s, f) => s + (f.blob.size || 0), 0) / 1024
  const estStr = estKB > 1024 ? (estKB / 1024).toFixed(1) + ' MB' : estKB.toFixed(0) + ' KB'

  return (
    <div className="panel">
      <div className="row">
        <label>录制帧率
          <select value={r.fps} onChange={e => r.setFps(+e.target.value)} disabled={r.recording}>
            <option value={10}>10 fps</option>
            <option value={15}>15 fps</option>
            <option value={20}>20 fps</option>
            <option value={24}>24 fps</option>
          </select>
        </label>
        <label>最大时长
          <select value={r.maxDur} onChange={e => r.setMaxDur(+e.target.value)} disabled={r.recording}>
            <option value={15}>15 秒</option>
            <option value={30}>30 秒</option>
            <option value={60}>60 秒</option>
            <option value={120}>2 分钟</option>
            <option value={9999}>不限</option>
          </select>
        </label>
        <label>缩放(省内存)
          <select value={r.scale} onChange={e => r.setScale(+e.target.value)} disabled={r.recording}>
            <option value={0.5}>50%</option>
            <option value={0.75}>75%</option>
            <option value={1}>原始</option>
          </select>
        </label>
      </div>

      <div className="privacy-banner">
        <b>⚠️ 隐私提示：</b>建议选择「窗口」或「标签页」共享，避免共享整个屏幕而误录密码、聊天、通知等敏感信息。录制前请关闭无关窗口。
      </div>

      <div className="preview-wrap">
        <video ref={r.videoRef} autoPlay muted playsInline style={{ display: r.streaming ? 'block' : 'none' }} />
        {!r.streaming && <div className="placeholder">点击「选择录制源」开始</div>}
        {r.countdown > 0 && <div className="countdown show">{r.countdown}</div>}
      </div>

      <div className="row controls">
        <button className="primary" onClick={r.selectSource} disabled={r.recording || r.countdown > 0}>选择录制源</button>
        <button onClick={r.start} disabled={!r.streaming || r.recording || r.countdown > 0}>开始录制</button>
        {r.countdown > 0 && <button onClick={r.cancelCountdown}>取消倒计时</button>}
        <button onClick={r.togglePause} disabled={!r.recording}>{r.paused ? '继续' : '暂停'}</button>
        <button className="danger" onClick={() => { const f = r.stop(); if (f && f.length) onFinish(f) }} disabled={!r.recording}>停止</button>
      </div>

      <div className="metrics">
        <div><span>已录帧</span><b>{r.frameCount}</b></div>
        <div><span>时长</span><b>{r.duration.toFixed(1)}s</b></div>
        <div><span>预估大小</span><b>{estStr}</b></div>
        <div><span>分辨率</span><b>{r.videoSize.w ? `${r.videoSize.w}×${r.videoSize.h}` : '—'}</b></div>
      </div>
    </div>
  )
}
