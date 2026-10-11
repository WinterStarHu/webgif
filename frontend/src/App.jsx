import React, { useState, useEffect } from 'react'
import { useRecorder } from './hooks/useRecorder'
import Recorder from './components/Recorder'
import Editor from './components/Editor'
import Exporter from './components/Exporter'

const PRIVACY_KEY = 'screen-gif-recorder-privacy-ack'

export default function App() {
  const r = useRecorder()
  const [view, setView] = useState('record')          // record | edit | export
  const [recordedFrames, setRecordedFrames] = useState([])
  const [exportData, setExportData] = useState(null)
  const [privacyAck, setPrivacyAck] = useState(false)

  useEffect(() => {
    setPrivacyAck(localStorage.getItem(PRIVACY_KEY) === '1')
  }, [])

  const ackPrivacy = () => {
    localStorage.setItem(PRIVACY_KEY, '1')
    setPrivacyAck(true)
  }

  const steps = [
    { key: 'record', label: '1 · 录制' },
    { key: 'edit', label: '2 · 编辑' },
    { key: 'export', label: '3 · 导出' },
  ]

  const onFinish = (frames) => {
    setRecordedFrames(frames)
    setView('edit')
  }

  return (
    <div id="app">
      <header className="topbar">
        <div className="brand">🎬 屏幕 GIF 工具</div>
        <nav className="steps">
          {steps.map(s => (
            <span key={s.key} className={`step ${view === s.key ? 'active' : ''}`}>{s.label}</span>
          ))}
        </nav>
        <div className="status">{r.status}</div>
      </header>

      {!privacyAck && (
        <div className="modal-mask">
          <div className="modal">
            <h2>🔒 隐私安全提醒</h2>
            <p>本工具会捕获你的屏幕画面并生成 GIF。使用前请注意：</p>
            <ul>
              <li><b>录制前关闭无关窗口</b>，避免聊天记录、密码、邮件、财务等敏感信息被录进去。</li>
              <li><b>尽量只共享单个窗口或标签页</b>，而不是整个屏幕，减少误录风险。</li>
              <li><b>检查输入框和通知</b>：录制时弹出的系统通知、自动填充的密码可能被捕获。</li>
              <li><b>导出前预览</b>：导出 GIF 前在编辑视图逐帧检查，删掉含隐私的帧。</li>
              <li>GIF 文件<b>无法真正删除元数据</b>，分享前请确认内容安全。</li>
            </ul>
            <p className="warn">点击「我已了解」即表示你确认对录制内容的安全负责。</p>
            <button className="primary" onClick={ackPrivacy}>我已了解，开始使用</button>
          </div>
        </div>
      )}

      {view === 'record' && <Recorder r={r} onFinish={onFinish} />}

      {view === 'edit' && recordedFrames.length > 0 && (
        <Editor
          frames={recordedFrames}
          fps={r.fps}
          onBack={() => { setRecordedFrames([]); setView('record') }}
          onExport={(data) => { setExportData(data); setView('export') }}
        />
      )}

      {view === 'export' && exportData && (
        <Exporter data={exportData} fps={r.fps} onBack={() => setView('edit')} />
      )}
    </div>
  )
}
