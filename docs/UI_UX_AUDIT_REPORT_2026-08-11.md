# Imago UI/UX 全面审计报告（2026-08-11）

**范围**：全部 10 个视图 + 共享组件/composables/stores/引擎层
**方法**：7 路并行静态审计 + 浏览器实测（拖拽/粘贴、缩放输入、裁切几何）
**分级**：P0 = 功能错误/数据丢失/用户点名问题；P1 = 明显流程缺陷或设计违背；P2 = 次要

---

## 1. 用户点名的三类问题（均复现确认）

### P0-A 首页拖入/粘贴图片无流程响应
- **位置**：`src/App.vue` `handleFiles`/`onGlobalDrop`/`onPaste`（L115-160）+ `HomeView.vue`
- **现象**：全局 drop/paste 只把图片加入 Pinia store，不按路由分发。首页无图片展示区，用户粘贴后停在首页、零反馈。**浏览器实测确认**：首页模拟粘贴 → URL 不变、无任何提示。
- **修复**：首页收到图片后跳转至核心工具页（/compress）并选中新图；或首页展示导入横幅 + "继续处理"入口。

### P0-B 缩放分辨率输入框，输入 4 位数文本与后缀重叠
- **位置**：`src/components/common/AppInput.vue`（`pr-14` + suffix `right-14` 重叠）
- **现象**：数字输入框 `padding-right:56px` 与 suffix 定位 `right:56px` 冲突；12px 字号下 4 位数（如 9999）文本尾部压到单位后缀（实测 9999 文本止于 41px，suffix 起于 36px，重叠 5px）。5 位数起输入框内容横向溢出（scrollWidth > clientWidth 实测）。
- **修复**：数字输入框布局重构——suffix 移出文本区或加宽 padding；同源问题：手动输入不钳制 min/max，0/负数直接透传（实测 0×0、-5×-3 可提交，`OffscreenCanvas(0,0)` 崩溃风险）。

### P0-C 裁切输出比目标少 1px（高度）
- **位置**：`src/lib/engines/cropEngine.ts:68-71`（ceil/floor）+ `CropView.vue:220-223`（Math.round）
- **现象**：显示端用 `Math.round` 取整百分比→像素，引擎端起点 `ceil`、终点 `floor`，两端规则不同。三分构图 1920×1080 显示 640×360、输出 639×359；拖边场景实测高度少 2px。
- **修复**：引擎与显示端统一取整函数（`round(start)`、`round(start+len)-round(start)`）。

---

## 2. P0（功能错误/数据丢失）

| # | 位置 | 问题 |
|---|------|------|
| P0-1 | `CombineView.vue:79-88` | `loadAndCacheImage` 无 `onerror`：HEIC/损坏图 Promise 永不 settle → 预览永久挂起，参数调整全部失效 |
| P0-2 | `combineEngine.ts:143-145` | 拼接尺寸无上限校验，超 canvas 上限静默输出全透明空白 PNG（数据丢失） |
| P0-3 | `SplitView.vue` + `useImageProcessor.ts:20-70` | `processSingle` 从不置 `isProcessing=true`：切分中无进度/无中止入口/可重复点击并发启动多任务，结果互相覆盖 |
| P0-4 | `BgRemoveView.vue:393-396` + worker | CTA 进度用 0-1 值直接拼 "%"，显示 "AI 处理中... 0.5%"（应为 50%），用户误判卡死 |
| P0-5 | `CropBox.vue:90-105` + `cropEngine.ts:41-64` | 旋转 90°/180° 后裁剪坐标系错位：UI 按未旋转局部帧、引擎按旋转帧换算，非对称裁剪输出区域与框选不符；比例锁定旋转后失效 |

## 3. P1（流程缺陷 / 设计违背）

### 3.1 CompressView
- **P1-1** 工具栏「全部导出」死按钮：结果存视图本地 Map，`downloadAllAsZip` 从 store 取 `processedBlob`（字段不存在）→ 静默 return
- **P1-2** 原生路径 `maxHeight` 被忽略（`maxWidthOrHeight` 单值，H<W 时只传 W）
- **P1-3** 目标体积输入无边界：空值静默按 10MB、负值劣化输出
- **P1-4** 切 PNG 后「目标体积」模式残留，参数静默失控
- **P1-5** 「已跳过」无 UI 标签，显示成虚假成功（DESIGN.md 5.1 明确要求）
- **P1-6** 处理失败不可见：`img.error` 无任何 UI 渲染，全项目无 toast
- **P1-7** 路由切换不中止处理：后台继续跑、结果泄漏、回页状态陈旧（DESIGN.md 2.2 违背）
- **P1-8** 处理中「恢复原图」可点击，重置被飞行中回调静默撤销（竞态）

### 3.2 SplitView
- **P1-1** 网格→自由编辑切换丢线：虚拟网格线不物化，画布全空退化为 1×1 导出整图；custom→grid→custom 旧线"复活"
- **P1-2** shave 零宽格静默跳过 → 导出空 zip，零反馈
- **P1-3** snapLine 吸附到 0/max 边界 → 零宽切片静默跳过，导出数与显示数不符

### 3.3 CombineView
- **P1-1** 拼接失败零反馈（仅 console.error）
- **P1-2** 恰 1 张图时双琥珀 CTA 同屏（违背 DESIGN.md 4.1 唯一性原则）
- **P1-3** 画布按上传序绘制、托盘按排序展示，两处顺序矛盾且拖拽被禁
- **P1-4** JXL/WebP2/AVIF 导出静默降级 PNG
- **P1-5** 预览解码全部原图 + 全尺寸画布 + 无防抖重绘（内存/性能）

### 3.4 CropView
- **P1-1** 导出格式选 JPEG（image/jpeg-li）/JXL/WebP2 静默降级 PNG（绕过 dualEngine）
- **P1-2** 进入视图/切换图片无条件弹「重置确认」模态框
- **P1-3** X/Y/W/H 输入无边界钳制：99999 → canvas 超限抛错；负数静默 1px；超宽输出透明扩展区

### 3.5 BgRemoveView / FiltersView
- **P1-1** 队列进度聚合失效（onProgress 被覆盖成死代码），多选时百分比跳变倒退
- **P1-2** Filters「实时预览」二次叠加：脏态预览叠加在旧结果上，预览≠结果
- **P1-3** 顶部进度条/Header 胶囊按全库计算，只处理选中子集时进度封顶（3 张选 1 张最多 33%）
- **P1-4** SAM2 交互抠图无入口：`ImageCard` 声明 emit 但从不触发，约 200 行流程不可达
- **P1-5** Filters「对比」按钮全部失效（未接 @compare）
- **P1-6** 导出格式/质量设置不生效（worker 硬编码 PNG），UI 却展示完整格式选择
- **P1-7** AI 处理失败无可见反馈；长任务无超时、无取消入口
- **P1-8** Filters 导出格式静默回退 PNG（同 Combine P1-4）

### 3.6 ExifView / FaviconView
- **P1-1** ICO 导出实为 PNG 字节（恒 image/png）
- **P1-2** `loadImage` 无 onerror → 生成流程可永久卡死
- **P1-3** JPEG 选项实际输出 PNG（image/jpeg-li 直传 toBlob）
- **P1-4** EXIF 读取失败被展示为"安全"（error 存储但从不渲染）
- **P1-5** 拖入新图不自动激活分析

### 3.7 共享层
- **P1-1** ZIP 导出同名条目互相覆盖（`useFileHelpers.ts:112,172-180`）→ 数据丢失
- **P1-2** 批量处理取消只中止最后创建的任务（`currentController` 被覆盖），其余继续跑完
- **P1-3** ImageCard 紧凑模式操作区依赖 hover，触屏不可达
- **P1-4** ImageUpload 本地 input 不重置 `target.value`，重复选择同一文件无响应
- **P1-5** AppLogo aria-label 乱码（mojibake）+ 硬编码中文
- **P1-6** 交互分割撤销到空点不重置 worker 会话，后续推理基于旧状态

## 4. P2 精选（规范/可访问性/边界）
- AppSlider 数值用 font-mono 而非 tabular-nums（DESIGN.md 4.2）
- AppInput 步进按钮 aria-label 硬编码中文「减少/增加数值」
- AppModal 硬编码 `id="modal-title"` 多实例冲突
- ImageCompare wheel 无条件劫持滚动
- AssetsTray wheel preventDefault 因 passive 失效
- useCanvasView zoomIn/Out 无钳制、非中心缩放
- ImageCard `z-35`/`duration-400` 非 Tailwind 默认类不生效；倍镜 blob URL 泄漏
- layoutStore localStorage 脏值无校验
- AppButton success 变体依赖类顺序覆盖
- 各视图硬编码颜色/文案未 token 化/i18n 化若干
- `HelloWorld.vue` 为脚手架死代码（不删，标注）

## 5. 修复优先级建议
1. 用户点名三件（P0-A/B/C）
2. 数据丢失类：Combine P0-1/P0-2、ZIP 同名覆盖（共享 P1-1）
3. 状态/流程断裂：processSingle isProcessing（Split P0-3）、路由切换中止（Compress P1-7）、进度单位（BgRemove P0-4）
4. 反馈缺失：死按钮（Compress P1-1）、假成功（Compress P1-5）、错误不可见（Compress P1-6、BgRemove P1-7）
5. 坐标系错误：Crop 旋转错位（P0-5）
6. 其余 P1 按视图批量修复
