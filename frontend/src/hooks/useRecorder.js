// useRecorder.js — getDisplayMedia 录屏 + canvas 抓帧（转 JPEG blob）
// 移植自 v1 recorder.js，改为 React hook + JPEG blob 输出
import { useRef, useState, useCallback } from 'react'

export function useRecorder() {
  const videoRef = useRef(null)
  const canvasRef = useRef(document.createElement('canvas'))
  const ctxRef = useRef(null)
  const rafRef = useRef(null)
  const metricTimerRef = useRef(null)
  const streamRef = useRef(null)
  const startTimeRef = useRef(0)
  const lastTimeRef = useRef(0)
  const recordingRef = useRef(false)
  const pausedRef = useRef(false)
  const countdownTimerRef = useRef(null)

  const [streaming, setStreaming] = useState(false)       // 已选源
  const [recording, setRecording] = useState(false)
  const [paused, setPaused] = useState(false)
  const [frames, setFrames] = useState([])                 // [{blob, w, h, t}]
  const [frameCount, setFrameCount] = useState(0)
  const [duration, setDuration] = useState(0)
  const [videoSize, setVideoSize] = useState({ w: 0, h: 0 })
  const [countdown, setCountdown] = useState(0)
  const [status, setStatus] = useState('就绪')

  const [fps, setFps] = useState(15)
  const [maxDur, setMaxDur] = useState(60)
  const [scale, setScale] = useState(0.5)

  // 选源
  const selectSource = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setStatus('浏览器不支持 getDisplayMedia，请用 Chrome/Edge')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: false,
      })
      streamRef.current = stream
      const v = videoRef.current
      v.srcObject = stream
      await v.play()
      await new Promise(r => (v.onloadedmetadata = r))
      const w = v.videoWidth, h = v.videoHeight
      setVideoSize({ w, h })
      setStreaming(true)
      setStatus(`已选源 ${w}×${h}`)
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        if (recordingRef.current) stop()
      })
    } catch (e) {
      setStatus('取消选源')
    }
  }, [])

  const resizeCanvas = useCallback(() => {
    const c = canvasRef.current
    c.width = Math.max(2, Math.round(videoSize.w * scale))
    c.height = Math.max(2, Math.round(videoSize.h * scale))
    ctxRef.current = c.getContext('2d', { willReadFrequently: false })
  }, [videoSize, scale])

  const updateMetrics = useCallback(() => {
    setFrameCount(framesRef.current.length)
    if (recordingRef.current) {
      setDuration((performance.now() - startTimeRef.current) / 1000)
    }
  }, [])

  const framesRef = useRef([])
  const captureFrame = useCallback(() => {
    if (!recordingRef.current) return
    if (!pausedRef.current) {
      const now = performance.now()
      const interval = 1000 / fps
      if (now - startTimeRef.current - lastTimeRef.current >= interval) {
        lastTimeRef.current += interval
        const ctx = ctxRef.current, c = canvasRef.current, v = videoRef.current
        try {
          ctx.drawImage(v, 0, 0, c.width, c.height)
          c.toBlob((blob) => {
            if (blob) {
              framesRef.current.push({ blob, w: c.width, h: c.height, t: now })
              setFrameCount(framesRef.current.length)
            }
          }, 'image/jpeg', 0.75)
        } catch (e) {}
        if ((performance.now() - startTimeRef.current) >= maxDur * 1000) {
          stop()
          return
        }
      }
      setDuration((performance.now() - startTimeRef.current) / 1000)
    }
    rafRef.current = requestAnimationFrame(captureFrame)
  }, [fps, maxDur])

  const begin = useCallback(() => {
    framesRef.current = []
    setFrames([])
    setFrameCount(0)
    recordingRef.current = true
    pausedRef.current = false
    setRecording(true)
    setPaused(false)
    startTimeRef.current = performance.now()
    lastTimeRef.current = 0
    setStatus('录制中…')
    captureFrame()
  }, [captureFrame])

  const start = useCallback(() => {
    if (!streaming) { selectSource(); return }
    resizeCanvas()
    setCountdown(3)
    let n = 3
    countdownTimerRef.current = setInterval(() => {
      n--
      if (n <= 0) {
        clearInterval(countdownTimerRef.current)
        countdownTimerRef.current = null
        setCountdown(0)
        begin()
      } else {
        setCountdown(n)
      }
    }, 1000)
  }, [streaming, resizeCanvas, begin, selectSource])

  const cancelCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    setCountdown(0)
    setStatus('已取消倒计时')
  }, [])

  const togglePause = useCallback(() => {
    if (!recordingRef.current) return
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
    setStatus(pausedRef.current ? '已暂停' : '录制中…')
  }, [])

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    recordingRef.current = false
    pausedRef.current = false
    setRecording(false)
    setPaused(false)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStreaming(false)
    const f = framesRef.current
    setFrames(f)
    setStatus(`已录制 ${f.length} 帧`)
    return f
  }, [])

  return {
    videoRef, canvasRef,
    streaming, recording, paused, frames, frameCount, duration, videoSize, countdown, status,
    fps, maxDur, scale, setFps, setMaxDur, setScale,
    selectSource, start, cancelCountdown, togglePause, stop,
  }
}
