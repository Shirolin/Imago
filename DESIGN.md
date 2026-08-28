# Imago · 暖纸

浏览器里的本地图片工作台。窗口是奶油纸，纸井浮在上面。不是深色 IDE，不是 Claude Design 这个产品，不是暗垫黄铜工艺台。

味道来自用户截的 Anthropic Claude Design：奶油纸、陶土、衬线字标、大圆角。只锁这些决策。不搬 Tweaks 栏、Stone/Moss 调味盘、Mobile/Web 分段。

## Tokens（代码真源，禁止另发明 hex）

- `--paper: #F9F8F6` 房间/底
- `--board: #FFFCFA` 浮起的纸板（侧栏、检查器）
- `--well: #F3F1EC` 纸井（空态和画布落点）
- `--ink: #2A2623` 不是纯黑
- `--muted: #8B8680`
- `--accent: #C45C32` 唯一强调，陶土。没有第二品牌色（不要薄荷、不要徽章青绿、不要黄铜 `#c4a574`）
- `--danger: #B54A4A` 只给删除
- `--radius-well: 28px` 纸井/主表面。这是张力，故意大
- `--radius-ctrl: 12px` 密控件。不要把检查器里每个按钮做成 32px 药丸
- 字体：字标和空态那一行用 Noto Serif SC（思源宋）。控件和规格用 Noto Sans SC。禁止 Inter / Geist / Roboto / Arial / IBM Plex（Plex 是工艺台的正文，这张不用）
- 栏不透明。禁止玻璃、blur、glow orb、彩色大投影。纸板可以用很浅的接触影 `0 1px 2px rgba(42,38,35,0.06)`

## 签名动效

图落到纸井上，纸铺平（translateY 8px → 0 + 透明度，280ms ease-out）。其余安静。不要揭起、不要灯箱闪光、不要 bounce。

## Keep

- 本地处理、Web Worker、队列、Abort
- 压缩 / 裁剪 / EXIF / 分割 / 拼接 / 去底 / 滤镜 / 站标
- 列表台 vs 画布台
- 棋盘格
- 规格数字 tabular（用 Noto Sans SC 的数字即可，不要再引一套英文等宽当品牌）
- 中文操作文案，i18n 结构
- 密度：检查器是工具台。大圆角和大留白只给纸井，不把整窗做成营销画布

## Forbid

- 深色观察室、灯箱那套 `--room #12151a` / `--accent #1e7a8a`
- Inter、薄荷+琥珀、彩虹工具色、Sparkles、英雄区
- 把 Claude Design 的布局当稿来描
- 暖铜金属、工艺台揭起
- 加倍整页留白、Geist、玻璃

## 文案

操作语言。空态：「把图放到这张纸上」。字标可以是衬线的 Imago，不要「隐私至上」。
