# 🎬 webgif

> 浏览器端的屏幕录制 → GIF 工具，支持逐帧编辑、片段裁剪、变速（加速后仍流畅）。React 前端 + Flask(Pillow) 后端，自签 HTTPS 部署，多客户端经内网/Tailscale 直接访问。

录屏做成 GIF，本来是个小需求，但要做到「浏览器形式 + 可编辑 + 加速流畅 + 多人能用」，踩了不少坑。这个项目是这些坑的解法。

---

## ✨ 功能

### 录制
- 基于 `getDisplayMedia` 捕获屏幕 / 窗口 / 标签页
- 可选帧率（10/15/20/24 fps）、最大时长、缩放比例（省内存）
- 3-2-1 倒计时、暂停 / 继续、实时帧数与时长统计、预估 GIF 大小
- 帧以 JPEG blob 存储（~50KB/帧），而非 RGBA（~2MB/帧），内存占用降 40 倍

### 编辑
- **逐帧缩略图时间轴**：横向滚动，每帧带时间码
- **片段裁剪**：拖动两端手柄选定区间，只导出选中部分
- **删除单帧**：点缩略图删除 / 恢复
- **变速**：0.5x 慢放 / 1x / 2x / 3x / 4x 加速，实时预览
- **预览播放**：按 delay 播放当前编辑结果

### 导出
- 后端 Pillow 编码动画 GIF（跨帧统一调色板，避免闪烁）
- 可选输出宽度（自适应 / 640 / 480 / 320）
- 编码进度条、文件大小、帧数、有效帧率显示
- 浏览器内预览 + 一键下载

---

## 🚀 快速开始

### 服务端（一次性安装）

```bash
git clone https://github.com/WinterStarHu/webgif.git
cd webgif

# Python 虚拟环境 + 依赖
python3 -m venv .venv
source .venv/bin/activate
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple flask pillow

# 前端构建
cd frontend
npm install
npm run build          # 输出到 ../backend/static
cd ..

# 生成自签证书
bash gen-cert.sh

# 启动 HTTPS 服务
python backend/app.py
```

### 客户端

浏览器（Chrome / Edge）打开：

```
https://<服务器IP>:5000
```

首次访问会提示证书不安全 → 点「高级」→「继续前往」→ 该机器以后不再提示。

> ⚠️ 必须用 HTTPS（或 localhost），否则 `getDisplayMedia` 屏幕捕获会被浏览器禁用（共享按钮变灰）。详见下文「踩过的坑」。

---

## 🏗 架构

```
客户端浏览器                服务端 Flask
┌──────────────┐  HTTPS   ┌──────────────────────┐
│  React SPA   │ ───────► │  托管前端静态文件      │
│              │          │                      │
│ getDisplayMedia│         │  /api/encode         │
│ (屏幕捕获)    │          │  接收 JPEG 帧 + delays │
│ canvas 抓帧  │  POST    │  → Pillow 编码 GIF    │
│ 编辑/变速     │ ───────► │  → 返回 image/gif    │
│              │ ◄─────── │                      │
│ 下载 GIF     │  GIF     │                      │
└──────────────┘          └──────────────────────┘
```

**职责划分：**
- **前端**：屏幕捕获、抓帧、编辑（裁剪/删帧/变速）、预览、下载。所有实时交互在浏览器完成
- **后端**：仅做 GIF 编码（Pillow）。把帧 JPEG + delays POST 过来，返回 GIF 字节流

**为什么 GIF 编码放后端？**
浏览器端自实现 LZW + median-cut 降色编码器可行（v1 试过），但调试痛苦、bug 难查。Pillow 是成熟库，编码可靠、质量好，跨帧调色板统一避免闪烁。

---

## 🛠 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 前端 | React 18 + Vite | 组件化 UI，Vite 构建到 Flask 托管 |
| 屏幕捕获 | `getDisplayMedia` (WebRTC) | 浏览器原生 API |
| 抓帧 | Canvas + `toBlob(JPEG)` | 按 fps 抓帧，JPEG 压缩省内存 |
| 后端 | Flask 3.x | Python，仅 `/api/encode` + 静态托管 |
| GIF 编码 | Pillow (PIL) | `quantize` 降色 + `save(save_all, optimize)` |
| HTTPS | OpenSSL 自签证书 | 满足 secure context 要求 |
| 网络 | Tailscale / 内网 IP | 多客户端访问，可不走公网 |

---

## 🔧 开发方法

### 本地开发（热重载）

```bash
# 终端1：Flask 后端
cd backend && python app.py

# 终端2：Vite 开发服务器（代理 /api 到 5000）
cd frontend && npm run dev
# → 访问 http://localhost:5173
```

Vite 配置了 `/api` 代理到 `localhost:5000`，前后端独立开发。

### 生产构建

```bash
cd frontend && npm run build   # 输出到 backend/static
cd ../backend && python app.py # Flask 托管构建产物
```

### 变速流畅性算法（核心）

GIF 加速如果只减小每帧 `delay`，撞到浏览器最小渲染延迟（~20ms）后反而卡顿。本工具采用 **抽帧重采样 + 重算 delay** 结合（`frontend/src/lib/sequence.js`）：

```
baseDelay = 1000 / fps
d_ms = baseDelay / speed

if d_ms >= 20ms:
    # 低倍率：不抽帧，仅减 delay（帧率最高、最流畅）
    kept = 所有帧
    delay = d_ms
else:
    # 高倍率：抽帧重采样
    T = N * baseDelay / speed      # 目标总时长
    M = round(T / 20)              # 抽到 M 帧
    kept = 均匀取 M 帧
    delay = T / M                  # ≥ 20ms

delay = max(20, round(delay))      # 钳到 ≥20ms
```

保证最终有效帧率落在 10–50fps 流畅区间，**不撞 20ms 最小渲染延迟**。

---

## 🕳 踩过的坑

### 1. 屏幕共享按钮变灰（secure context）
**现象**：`getDisplayMedia` 弹窗里「屏幕/窗口/标签页」选项灰色不可选。
**根因**：`getDisplayMedia` 要求 **secure context**（HTTPS 或 localhost）。用 `http://内网IP` 访问时被浏览器禁用。
**解法**：服务端用自签证书启 HTTPS。客户端首次手动信任证书。
**教训**：这是 Web 安全限制，不是 bug。所有录屏工具都会遇到。

### 2. WSL2 localhost 跨机不通
**现象**：Flask 跑在 WSL，Windows 浏览器用 `http://localhost:5000` 访问被拒绝。
**根因**：WSL2 用独立虚拟网卡，localhost 不跨 Windows/WSL。
**解法**：用 Tailscale 分配的 IP（`100.106.9.63`）+ HTTPS 访问，绕过 localhost 隔离。

### 3. 自实现 GIF 编码器的调试噩梦（v1）
**现象**：v1 自己实现 LZW + median-cut，出过 `btnReset` id 不匹配导致 `init()` 中断、所有按钮失效的 bug，排查极难。
**根因**：自实现编码逻辑复杂，任何一处 null 引用就让整条链路静默失败。
**解法**：v2 把编码移到后端 Pillow，成熟库替代自实现，可靠性大幅提升。

### 4. Pillow 跨帧调色板 API
**现象**：`quantize(palette=list)` 报 `AttributeError: 'list' object has no attribute 'load'`。
**根因**：`palette` 参数需要 **Image 对象**（P 模式），不是 list。
**解法**：第一帧 `quantize()` 得到 P 模式图像，后续帧 `quantize(palette=首帧P图像)` 复用其调色板，避免帧间闪烁。

### 5. WSL 源码与构建产物不同步
**现象**：改了 Windows 源码，WSL 内 `npm run build` 产物没变。
**根因**：WSL `~/screen-gif-recorder-v2` 是从 `/mnt/c` 复制的副本，改 Windows 源码后需重新同步到 WSL。
**教训**：开发时统一在 WSL 内编辑源码，或用 `wsl` 挂载 `/mnt/c` 统一路径。

---

## 🔒 安全与隐私

### 隐私提醒（产品内建）
- **首次进入弹窗**：列出 5 条隐私注意事项，用户确认后才进入
- **录制页横幅**：常驻提示「建议选窗口/标签页共享，避免误录密码、聊天、通知」
- **导出前预览**：编辑视图可逐帧检查、删掉含隐私的帧

### 录屏隐私建议
1. **优先共享单个窗口/标签页**，而非整个屏幕——减少误录范围
2. **录制前关闭无关窗口**：聊天、邮件、财务软件等
3. **注意系统通知**：录制时弹出的通知（含消息预览）会被捕获
4. **检查输入框**：浏览器自动填充的密码可能在录制时暴露
5. **导出前逐帧检查**：在编辑视图滚动时间轴，删掉任何含敏感信息的帧
6. **GIF 无法真正删元数据**：分享前请确认内容安全

### HTTPS 与加密
- **传输加密**：自签 TLS 证书，客户端↔服务端所有流量加密（帧数据、GIF 都走 HTTPS）
- **自签证书**：用 OpenSSL 本地生成（不联网），SAN 包含服务器 IP；客户端首次手动信任
- **私钥不入库**：`cert.pem` / `key.pem` 在 `.gitignore` 中，绝不进 Git 仓库
- **纯局域网**：可不经过公网，仅内网 / Tailscale 点对点直连，数据不落第三方

### 服务端安全注意
- Flask 开发服务器仅适合内网/小范围使用，**生产环境建议换 Gunicorn/uWSGI + Nginx**
- `/api/encode` 接收大帧数据，建议加请求体大小限制和频率限制
- 自签证书不被浏览器信任是预期行为，不要为了消除警告而禁用证书校验

---

## 📁 项目结构

```
webgif/
├── backend/
│   ├── app.py              # Flask：静态托管 + /api/encode（Pillow 编码）
│   └── requirements.txt    # flask, pillow
├── frontend/
│   ├── package.json
│   ├── vite.config.js      # build → ../backend/static
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx          # 三视图 + 隐私弹窗
│       ├── app.css
│       ├── hooks/
│       │   └── useRecorder.js   # getDisplayMedia + canvas 抓帧
│       ├── components/
│       │   ├── Recorder.jsx     # 录制视图
│       │   ├── Editor.jsx       # 时间轴/选区/删帧/变速/预览
│       │   └── Exporter.jsx     # 调 /api/encode + 下载
│       └── lib/
│           ├── sequence.js      # 变速重采样算法
│           └── api.js           # POST /api/encode
├── gen-cert.sh              # 生成自签证书
├── run-server.sh            # 一键：证书 + 构建 + 启动
├── start.ps1                # Windows 客户端启动脚本
└── README.md
```

---

## 📄 License

MIT
