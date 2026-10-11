# start.ps1 — Windows 客户端一键启动：在 WSL 起服务 + 打开浏览器
# 直接访问 https://Tailscale-IP（自签 HTTPS），多客户端通用
# 用法: 在任一 Windows 客户端运行 .\start.ps1

$WSL_USER = "winter"
$WSL_HOST = "100.106.9.63"      # WSL Tailscale IP
$PORT = 5000
$URL = "https://${WSL_HOST}:${PORT}"

# 本脚本可在任意已加入 WSL 的 Windows 上启动服务；若 WSL 在远端，可直接跳到打开浏览器
param(
  [switch]$RemoteOnly   # 跳过本地启动 WSL（服务已在跑）
)

if (-not $RemoteOnly) {
  # 尝试在本地 WSL 启动服务（若本机有 WSL 且项目存在）
  $hasWsl = $null -ne (Get-Command wsl.exe -ErrorAction SilentlyContinue)
  if ($hasWsl) {
    Write-Host "在 WSL 中启动 Flask 服务..." -ForegroundColor Cyan
    Start-Process -FilePath "wsl.exe" `
      -ArgumentList "-d","Ubuntu","--","bash","-c","cd ~/screen-gif-recorder-v2 && source .venv/bin/activate && python backend/app.py" `
      -WindowStyle Hidden
    Start-Sleep -Seconds 3
  } else {
    Write-Host "本机无 WSL，假设服务已在 WSL 主机上运行" -ForegroundColor Yellow
  }
}

Write-Host "打开浏览器 $URL ..." -ForegroundColor Cyan
Start-Process $URL

Write-Host ""
Write-Host "首次访问会提示证书不安全：" -ForegroundColor Yellow
Write-Host "  点「高级」→「继续前往 100.106.9.63(不安全)」" -ForegroundColor Yellow
Write-Host "  以后该机器不再提示" -ForegroundColor Yellow
Write-Host ""
Write-Host "地址: $URL" -ForegroundColor Green
