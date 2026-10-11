#!/bin/bash
# gen-cert.sh — 用 openssl 生成自签证书（不联网、本地生成）
# 生成 backend/cert.pem 和 backend/key.pem
# 证书 SAN 包含 Tailscale IP 100.106.9.63 和 localhost，避免部分浏览器警告
cd "$(dirname "$0")/.."
CERT=backend/cert.pem
KEY=backend/key.pem

if [ -f "$CERT" ] && [ -f "$KEY" ]; then
  echo "证书已存在: $CERT / $KEY（如需重新生成请先删除）"
  exit 0
fi

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$KEY" -out "$CERT" \
  -days 3650 \
  -subj "/CN=screen-gif-recorder" \
  -addext "subjectAltName=IP:100.106.9.63,DNS:localhost,IP:127.0.0.1" \
  2>/dev/null

if [ -f "$CERT" ] && [ -f "$KEY" ]; then
  echo "✓ 证书已生成:"
  echo "  $CERT"
  echo "  $KEY"
  echo "  （有效期 10 年，SAN: 100.106.9.63 / localhost / 127.0.0.1）"
else
  echo "✗ 生成失败，请确认 openssl 已安装"
  exit 1
fi
