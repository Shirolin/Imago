# Imago · 暖纸

浏览器里的本地图片工作台。奶油画布，陶土一点，衬线字标。检查器是工具，不是营销页。

味道对齐 Claude / Claude Code 产品语言：奶油画布、珊瑚陶土、衬线字标、细线、密控件。不搬 Tweaks 栏、Stone/Moss 调味盘、Mobile/Web 分段。

## Tokens（代码真源，禁止另发明 hex）

- `--paper: #FAF9F5` 画布/房间
- `--board: #F5F0E8` 侧栏、检查器（比画布深一档，不是浮白）
- `--well: #EFE9DE` 纸井（空态和画布落点）
- `--ink: #141413` 近黑暖墨
- `--muted: #6C6A64`
- `--accent: #CC785C` 唯一强调，珊瑚。没有第二品牌色（不要薄荷、不要徽章青绿、不要黄铜 `#c4a574`）
- `--accent-press: #A9583E` 按下
- `--danger: #C64545` 只给删除
- `--hairline: #E6DFD8` 分割线。禁止粗描边、禁止彩色描边
- `--product: #181715` 图卡片等产品面，奶油上的深海军。不跟主题反色
- `--on-product: #FAF9F5`
- `--radius-well: 20px` 纸井。工作台，不是杂志 32px
- `--radius-ctrl: 8px` 控件。不要药丸
- 字体：字标和空态那一行用 Noto Serif SC，字重 500，字距约 `-0.02em`。控件和规格用 Noto Sans SC，字重 400–500。禁止 Inter / Geist / Roboto / Arial / IBM Plex
- 栏不透明。禁止玻璃、blur、glow orb、彩色大投影。纸板无投影，或最多 `0 1px 2px rgba(20,20,19,0.06)`

## 深色

`data-theme=dark` 用海军产品面，不是旧灯箱。

- `--paper: #181715`
- `--board: #252320`
- `--well: #1F1E1B`
- `--ink: #FAF9F5`
- `--muted: #A09D96`
- `--hairline: #3A3834`
- `--product: #181715` 图卡片面，比 board 深一档
- `--accent` 不变

## 签名动效

图落到纸井上，纸铺平（translateY 8px → 0 + 透明度，280ms ease-out）。其余安静。不要揭起、不要灯箱闪光、不要 bounce、不要 hover 上浮。

## Keep

- 本地处理、Web Worker、队列、Abort
- 压缩 / 裁剪 / EXIF / 分割 / 拼接 / 去底 / 滤镜 / 站标
- 列表台 vs 画布台
- 棋盘格
- 规格数字 tabular
- 中文操作文案，i18n 结构
- 密度：检查器是工具台。大圆角和大留白只给纸井

## Forbid

- 深色观察室那套 `--room #12151a` / `--accent #1e7a8a`
- Inter、薄荷+琥珀、彩虹工具色、Sparkles、英雄区
- 把 Claude Design 的布局当稿来描
- 暖铜金属、工艺台揭起
- 加倍整页留白、Geist、玻璃
- `font-black`、控件 `uppercase tracking-widest`、主按钮投影、`hover:-translate-y`

## 文案

操作语言。空态：「把图放到这张纸上」。字标可以是衬线的 Imago，不要「隐私至上」。
