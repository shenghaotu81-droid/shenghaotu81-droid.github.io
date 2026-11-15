# 涂盛皓 · 海岸研究所

可进出的暖白研究所、海岸步道、树荫与观景平台。静态 HTML/CSS/JavaScript，Three.js 0.187.0 通过 import map 加载；没有后端、管理页或个人 token。

稳定展厅 `1913eff` 已按用户确认合入并推送到 main，Pages 发布成功。当前海岸迭代在 `feat/open-world-garden`，未经审阅不合入 main。

## 预览

```sh
python3 -m http.server 8000
```

用 **Windows 本机的硬件加速浏览器**打开 http://localhost:8000 。不要在此 WSL 中启动自动浏览器、Playwright 或软件 WebGL：此前已造成主机崩溃。已知软件渲染器会降级到文字阅读。

桌面：点击进入锁定鼠标，WASD / 方向键移动，Shift 快跑，空格轻跳，E 阅读，R 返回入口，Esc 暂停。滚轮调整 43–66° 视野。手机：左摇杆移动（外圈快跑），右侧滑动环顾，独立跳跃按钮和 ⌂ 返回按钮。展区导航可快速前往四个室内区域。

## 内容：只改 JSON

| 文件 | 用途 |
| --- | --- |
| `content/profile.json` | 个人介绍、技能、联系方式 |
| `content/projects.json` | 正在做的事与项目 |
| `content/notes.json` | 学习笔记 |
| `content/papers.json` | 论文与阅读记录 |
| `content/ui.json` | 中英文界面 |
| `content/exhibits.json` | 展品来源、授权与启用状态 |

在相应的 `items` 数组中新增条目即可，`id` 在文件内唯一：

```json
{
  "id": "unique-entry-id",
  "title": "真实标题",
  "summary": "简短摘要",
  "body": "正文，纯文字",
  "tags": ["C++"],
  "url": "",
  "titleEn": "English title",
  "summaryEn": "English summary",
  "bodyEn": "English text"
}
```

中文标题、摘要缺失时显示待补充；英文缺失时显示待翻译的占位。正文与链接可留空，链接只接受 HTTP/HTTPS。长列表自动进入阅读面板，不必改 JavaScript。新增区域或改变布局仍需改代码。

文字版和三维展板共用数据；无 WebGL 时可正常阅读，无 JavaScript 时读取生成的 HTML 快照。main 的 Pages 工作流会生成快照。为避免与分支式 Pages 重复发布，Pages Source 应统一使用 GitHub Actions；本次未改仓库设置。

## 场景与性能

- `scripts/coast.js`：地形、环线、木平台、植被、固定午后天空与海面。均为代码几何，没有新增模型或 HDR 下载。
- `scripts/physics.js`：Three.js 官方 Capsule / Octree，重力、跑跳、地形及立体碰撞。与画面绘制分离。
- `scripts/keyboard.js`：独立键盘接线，可用 Node 测试。
- `scripts/render-policy.js`：识别已知软件渲染器并降级到文字版。
- 默认像素比上限 1，漫游绘制上限 24 fps。欢迎页、暂停、阅读及后台不持续绘制。默认关闭实时阴影与后处理；`?quality=high` 只作为硬件浏览器的显式选项。
- 原有五件 GLB 总计 901,608 bytes，按距离逐个加载并缓存。入口使用原创几何机器人，机甲缩小为阅读区的次展品。旧 RobotExpressive、Xbot、Flamingo 保留以便回退，新场景不引用它们。
- 展品授权、实际体积与来源见 `credits.html`、`models/exhibits/README.md`。

## 无 GPU 验证

```sh
python3 scripts/build_content.py
python3 scripts/validate_assets.py
node tests/input_cpu.test.mjs
python3 tests/setup_three_cpu.py
node --max-old-space-size=128 --import ./tests/register-three.mjs tests/coast_cpu.test.mjs
python3 tests/http_smoke.py
```

CPU 测试在 Node 24 验证，通过临时目录缓存同版本 Three.js JS 模块，不安装浏览器；使用无绘制替身构建**实际场景**，测试真实碰撞网格、整圈步道、室内路线和实际键盘接线。HTTP 检查启动短时 Python 服务器后自动关闭。浏览器自动测试已删除，资源约束见 `AGENTS.md`。

只有 `?debug` 暴露本地诊断与 CPU 模拟入口，默认访问不暴露。最终画面与 Windows 原生组合键需人工复核，详见 `docs/open-world-verification.md`。
