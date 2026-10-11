#!/bin/bash
# run-server.sh — 在 WSL 内启动服务（生成证书 + 启动 Flask）
# 用法: cd ~/screen-gif-recorder-v2 && bash run-server.sh
cd "$(dirname "$0")"
source .venv/bin/activate

# 1. 生成自签证书（首次）
if [ ! -f backend/cert.pem ] || [ ! -f backend/key.pem ]; then
  echo "生成自签证书..."
  bash gen-cert.sh
fi

# 2. 构建前端（首次或前端有改动）
if [ ! -d backend/static/assets ]; then
  echo "构建前端..."
  cd frontend && npm install && npm run build && cd ..
fi

# 3. 启动 Flask (HTTPS)
echo "启动 Flask HTTPS → https://100.106.9.63:5000"
python backend/app.py
