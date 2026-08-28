# Imago · 灯箱

浏览器里的本地图片工作台。窗口是冷观察室，中间一块亚克力灯箱。不是薄荷 SaaS，不是暖铜工艺台。

## Tokens（代码真源，禁止另发明 hex）

- `--room: #12151a` 观察室
- `--chrome: #1a1e25` 不透明栏
- `--well: #dce3eb` 亚克力灯箱（画布/空态落点）
- `--ink: #e8eaee` 栏上文字
- `--ink-well: #1a1d22` 灯箱上文字
- `--muted: #8b93a0`
- `--accent: #1e7a8a` 唯一强调。没有第二品牌色。没有琥珀 CTA。
- `--danger: #b54a4a` 只给删除
- `--radius: 6px` 上限。禁止 pill / rounded-2xl 当默认
- 字体：IBM Plex Sans + Noto Sans SC；数字规格 IBM Plex Mono。禁止 Inter / Roboto / Arial / Geist / 宋体字标
- 栏不透明，禁止玻璃、blur、glow orb、彩色投影

## 签名动效

图落到灯箱上，灯箱亮度短暂抬一下（`--well` 向白偏 8%，180ms，ease-out），然后稳住。其余安静。不要揭起、不要一压、不要 bounce。

## Keep

- 本地处理、Web Worker、队列、Abort
- 压缩 / 裁剪 / EXIF / 分割 / 拼接 / 去底 / 滤镜 / 站标
- 列表台 vs 画布台两种交互
- 棋盘格（透明通道）
- 规格数字（KB、尺寸、比例）tabular
- 中文操作文案，i18n 结构留下
- 密度：工具台，不要加倍留白

## Forbid

- Inter、Geist、system-ui 点名当品牌字
- 薄荷 primary + 琥珀 CTA 两套品牌色
- 每工具一条彩虹（emerald/blue/purple/pink/violet）
- Sparkles / 英雄区「隐私至上」「现代化」「智能压缩」
- HelloWorld.vue、未使用 vite.svg 当装饰
- 玻璃顶栏、hover lift 配彩色大阴影、shimmer 当性格
- 暖铜 `#c4a574`、宋体字标、工艺台/压片台那套

## 文案

操作语言。空态写「把图放到灯箱上」，不要「开始你的创作之旅」。
