# 涂盛皓 · 空间笔记

暖白研究展厅。静态 HTML/CSS/JavaScript，Three.js 0.187.0 经 import map 从 CDN 加载。没有管理页、后端或个人 token。

## 本地预览

```sh
python3 scripts/build_content.py
python3 -m http.server 8000
```

打开 http://localhost:8000 。桌面点击「走进这个空间」锁定鼠标，WASD / 方向键移动，E 阅读近处展板，Esc 释放鼠标。滚轮调整 43–66° 视野，不改变角色大小。手机左摇杆移动、右侧画面滑动环顾；展区导航可直接到达各区。墙、庭院、展台和盆器阻挡移动。长文阅读时暂停移动。

「文字阅读」一直可用；无 WebGL、CDN 加载失败、模型缺失时仍可阅读。无 JavaScript 时读取预生成的 HTML 快照。

## 加内容：只编辑 JSON

- `content/profile.json`：个人介绍、技能、链接。
- `content/projects.json`：项目和正在做的事。
- `content/notes.json`：学习笔记。
- `content/papers.json`：论文与阅读记录。
- `content/exhibits.json`：模型来源、授权与接入状态。

在 `items` 数组中添加条目，不需要改 JavaScript：

```json
{
  "id": "unique-entry-id",
  "title": "真实标题",
  "status": "学习中",
  "summary": "简短摘要",
  "body": "正文（纯文字）",
  "tags": ["C++"],
  "url": ""
}
```

标题、摘要缺失时显示待补充；正文、链接可留空。`id` 必须在所属文件内唯一。JSON 中的文字按纯文本呈现，链接只接受 HTTP/HTTPS。长列表在阅读面板滚动，场景展板展示摘要；超过四项的项目也都会出现在工作区阅读面板。新增场景区域和改变空间布局仍需改代码。

双语字段：条目可填写 `titleEn`、`summaryEn`、`bodyEn`、`statusEn`、`tagsEn`；界面文字在 `content/ui.json`。英文翻译缺失时标为待补充。右上角、阅读面板及入口三维导览牌可切换语言，偏好只存在浏览器 localStorage。切换不改变位置和视角。

在支持 JavaScript 的文字版与场景中，JSON 提交发布后会自动读取。无 JavaScript 的快照由 `python3 scripts/build_content.py` 生成。附带的 GitHub Actions Pages 工作流会在 main 更新时自动生成快照并发布，用户无需运行脚本；启用该工作流需要仓库 Pages 的 Source 设置为 GitHub Actions。请在审核合并时决定切换，当前没有更改线上设置。

## 资源与性能

新模型及景观共 901,608 bytes（约 880.5 KiB），按距离逐个加载；同一资源只请求一次。默认像素比上限为 1，关闭实时阴影，漫游上限 24 fps；欢迎页、暂停、文字阅读和后台不持续渲染。可以显式使用 `?quality=high` 开启桌面阴影和更高像素比，上限 30 fps。无后处理、HDR、大纹理字体或物理引擎。

入口使用与建筑材质统一的原创几何机器人；另有三件来自 Quaternius Ultimate Space Kit 和 Kenney Factory Kit 的 CC0 空间展品，无需下载登录。较厚重的机甲缩小为阅读区的次展品，机械臂使用原节点摆出工作姿态。模型、授权、转换及实测体积见 `models/exhibits/README.md` 与 `credits.html`。RobotExpressive、Xbot、Flamingo 保留在仓库以便回退，新站不引用它们。

仅在 `?debug` 时暴露诊断状态 `window.galleryDebug`，用于本地验收位置、碰撞和资源加载。默认访问不暴露。碰撞单元验证：`node scripts/navigation.test.mjs`。

## 验证

```sh
python3 scripts/validate_assets.py
node scripts/navigation.test.mjs
```

浏览器检查脚本为 `tests/browser_smoke.py`，需要另行安装 Playwright 及 Chromium headless shell，先运行本地 HTTP 服务器。分别传入 `desktop`、`mobile`、`fallback`、`visual`、`assets` 或 `regression`（更短的最终回归）；一次只运行一个，每次最长 45 秒，自动关闭浏览器。脚本使用半分辨率，只短时移动，不做长时间 GPU 压力测试。详情见 `docs/verification.md`。
