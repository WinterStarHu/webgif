# app.py — Flask 后端：托管前端构建产物 + /api/encode（Pillow 编码动画 GIF）
import io
import os
import json
from flask import Flask, request, jsonify, send_from_directory, Response
from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(BASE, 'static')   # 前端 vite build 输出到此

app = Flask(__name__, static_folder=None)


@app.route('/')
def index():
    idx = os.path.join(STATIC, 'index.html')
    if os.path.exists(idx):
        return send_from_directory(STATIC, 'index.html')
    return '<h1>前端未构建</h1><p>请先在 frontend 目录运行 <code>npm install &amp;&amp; npm run build</code></p>', 200


@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(STATIC, path)


@app.route('/api/encode', methods=['POST'])
def encode():
    """接收 multipart：frames[]（JPEG 字节）+ json（{delays:[ms...], width, loop}）
    返回 image/gif 字节流。"""
    meta_raw = request.form.get('json') or request.form.get('meta')
    if not meta_raw:
        return jsonify({'error': '缺少 json 参数'}), 400
    try:
        meta = json.loads(meta_raw)
    except Exception as e:
        return jsonify({'error': f'json 解析失败: {e}'}), 400

    delays = meta.get('delays', [])
    width = meta.get('width', 0)   # 0 = 自适应（用第一帧宽）
    loop = meta.get('loop', 0)
    files = request.files.getlist('frames')
    if not files:
        return jsonify({'error': '缺少 frames'}), 400

    frames = []
    palette_img = None   # 第一帧 quantize 得到的 P 模式图像，用作后续帧的 palette 源
    for i, f in enumerate(files):
        try:
            img = Image.open(f.stream).convert('RGB')
        except Exception as e:
            return jsonify({'error': f'帧 {i} 解码失败: {e}'}), 400
        # 缩放到目标宽度
        if width and width > 0 and img.width > width:
            nh = round(img.height * width / img.width)
            # 偶数尺寸
            img = img.resize((width & ~1, nh & ~1), Image.LANCZOS)
        # 降色为 P 模式。第一帧生成调色板，后续帧复用以避免闪烁
        if palette_img is None:
            p = img.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.NONE)
            palette_img = p
            frames.append(p)
        else:
            # quantize 的 palette 参数需要 Image 对象（P 模式，提供其调色板）
            p = img.quantize(colors=256, palette=palette_img, dither=Image.NONE)
            frames.append(p)

    # 对齐 delays 与 frames
    n = len(frames)
    if not delays:
        delays = [100] * n
    if len(delays) < n:
        delays += [delays[-1]] * (n - len(delays))
    elif len(delays) > n:
        delays = delays[:n]
    # 钳到 ≥20ms，避免播放器把过短 delay 钳为更慢
    delays = [max(20, int(d)) for d in delays]

    first = frames[0]
    rest = frames[1:]
    buf = io.BytesIO()
    try:
        first.save(
            buf,
            format='GIF',
            save_all=True,
            append_images=rest,
            duration=delays,
            loop=loop,
            optimize=True,
            disposal=2,
        )
    except Exception as e:
        return jsonify({'error': f'GIF 编码失败: {e}'}), 500

    data = buf.getvalue()
    return Response(data, mimetype='image/gif', headers={
        'Content-Length': str(len(data)),
        'Cache-Control': 'no-store',
    })


if __name__ == '__main__':
    os.makedirs(STATIC, exist_ok=True)
    cert = os.path.join(BASE, 'cert.pem')
    key = os.path.join(BASE, 'key.pem')
    use_https = os.path.exists(cert) and os.path.exists(key)
    if use_https:
        app.logger.info('HTTPS 已启用（自签证书）')
        app.run(host='0.0.0.0', port=5000, debug=False,
                ssl_context=(cert, key))
    else:
        app.logger.warning('未找到 cert.pem/key.pem，以 HTTP 启动（屏幕捕获将不可用，请先运行 gen-cert.sh）')
        app.run(host='0.0.0.0', port=5000, debug=False)
