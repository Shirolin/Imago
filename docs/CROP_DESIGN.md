# Imago 裁剪模块 (Crop Module) 详细设计与重构防坑指南

## 1. 架构总览 (Architectural Overview)

裁剪模块采用 **"画布容器 (AppCanvasWorkspace) + 核心裁剪引擎 (CropBox)"** 的解耦架构。

- **AppCanvasWorkspace**：负责全局视角的上帝导航（缩放 Scale、平移 Offset、抓手模式）。
- **CropBox**：专注于图片本身的百分比坐标映射、形变、辅助线与放大镜渲染。
  > **防坑警告**：任何对 `AppCanvasWorkspace` 的修改（特别是涉及到坐标和平移），都极易影响子组件的坐标对齐。本阶段打磨的核心就是**解除父子坐标系的物理冲突**。

## 2. 核心交互引擎：零延迟与坐标系对冲 (Core Interaction Engine)

### 2.1 彻底解决“平移时的两倍速飞离”Bug

- **问题重现**：当用户使用鼠标中键或 `Alt` 键平移画布时，如果 `CropBox` 也同时捕获了该事件，会导致画布位移和选框位移叠加，视觉上裁剪框以“两倍速”逃离。
- **终极方案**：
  1. **严格按键过滤**：在 `CropBox.vue` 的 `handleStart` 中，强制忽略 `e.button !== 0` (非左键) 以及 `e.altKey` 的拖拽事件。
  2. **抓手互斥锁 (`isHandMode`)**：将 `AppCanvasWorkspace` 的 `isHandMode` 状态作为 prop 注入 `CropBox`。当按下空格时，强行 `return` 终止裁剪交互逻辑。

### 2.2 坐标系对冲：实时读取 `getBoundingClientRect`

- **血泪史**：曾尝试在 `handleStart` 缓存 `cachedRect` 以提升性能（避免 Layout Thrashing）。但一旦发生画布平移（父级 Translate 改变），缓存的坐标就失效了，导致选框跟随鼠标时狂闪。
- **真理**：在 `handleMove` 的 `requestAnimationFrame` 中**每帧实时读取** `containerRef.value.getBoundingClientRect()`。这是在画布动态平移场景下，保证子组件相对坐标绝对同步的唯一数学解。

### 2.3 零延迟物理同步 (Zero-Latency Sync)

- **问题**：CSS 的 `transition: transform` 会导致视觉上的平移滞后于鼠标的实际物理坐标，这会让 `CropBox` 计算出错误的差值。
- **解决方案**：在拖拽 (`isDragging`) 或平移 (`isPanning`) 期间，强制禁用所有过渡动画：`class="[isPanning ? 'transition-none' : transformDuration]"`。交互必须是 0 延迟的像素级同步。

## 3. 旗舰级视觉与物理反馈 (Flagship UX & Polish)

### 3.1 放大镜智能象限避让算法 (Smart Magnifier Dodge)

- **设计心思**：放大镜绝对不能遮挡用户正在操作的关键区域（尤其是四角）。
- **实现机制**：计算鼠标在图片上的百分比坐标 (`activePercent`)。如果在右上角，放大镜通过 `translate(-125%, 25%)` 自动移动到左下。动态交叉换位，确保永远处于对角线安全区。

### 3.2 弹性比例动画 (Elastic Proportion Motion)

- **设计心思**：切换 1:1、16:9 比例时，不能是生硬的跳变。
- **实现机制**：引入 `cubic-bezier(0.34, 1.56, 0.64, 1)` 的 Q 弹曲线。
- **防坑警告**：弹性动画**仅在非拖拽状态下生效** (`:not(.is-dragging)`)，一旦用户开始手动拖拽，必须强制 `transition: none !important` 以避免“果冻效应”。

### 3.3 数值防抖与视觉除噪 (Jitter Elimination)

- **设计心思**：拖拽选框时，下方悬浮的 `1280 × 720 PX` 提示会因为数字 1 和 8 的宽度不同而不断左右震颤。
- **实现机制**：给数值容器增加 `tabular-nums` 强制等宽字体渲染，稳如磐石。

### 3.4 强制光标穿透保护 (Forced Hand Cursor)

- **设计心思**：按下空格进入抓手模式时，如果鼠标恰好放在了裁剪框的边框上，手型光标会被子组件的 `cursor-move` 覆盖，破坏沉浸感。
- **实现机制**：父级赋予 `.cursor-grab-forced` 类，并在局部 CSS 中使用 `.cursor-grab-forced * { cursor: grab !important; }` 物理级强压所有子元素的光标状态。

## 4. UI 布局与信息解耦 (UI Decoupling)

### 4.1 工业检查器视觉规范 (Industrial Inspector)

- 侧边栏所有 Section 统一采用 `border-t border-border/40` 分割线，并配合 `pt-6` 创造严谨的节奏感。TRIM (边缘精修) 模块作为“后处理 (Post-Process)”，使用琥珀色进行强烈的视觉语义隔离。

### 4.2 下沉式操作提示 (Sunken Tooltip)

- **防坑警告**：曾把“双击重置全图”放在顶部，结果遮挡了裁剪框顶部的缩放拉手（Top Handle）。
- **最终方案**：将宏观提示（按住空格平移）留在屏幕顶部；将局部操作提示（双击重置）下沉到选框底部的 `PX` 数值下方。与选框结为一体，永不遮挡关键交互区。

### 4.3 设备感知 (Device Awareness)

- 使用 `hidden sm:flex` 隐藏了移动端不存在的“Space 空格键”提示图标，移动端只显示纯净的“上帝视角预览”。

## 5. 快捷键与状态流 (Shortcuts & History State)

### 5.1 历史记录的防抖与瞬发

- 基于 `allSettings` 的深拷贝实现。
- **离散操作**（如点击旋转、翻转、颜色）：使用 `recordImmediate()` 瞬间保存状态。
- **连续操作**（如输入框打字、拖拽）：输入框使用 `useDebounceFn` 防抖提交；拖拽则仅在 `handleStart` 记录起始帧，在 `handleEnd` 记录结束帧，抛弃中间过程。

### 5.2 全局快捷键沙箱

- 监听 `Ctrl+Z` 和 `Ctrl+Y`。
- **致命防坑**：必须识别 `document.activeElement.tagName === 'INPUT'`，否则用户在输入数值时按 Z 会触发撤销，导致数据直接丢失或状态倒退。

## 6. GPU 合成层安全 (GPU Compositor Safety)

- **防坑警告**：之前为了让动画更顺滑，在 `CropBox` 加了 `will-change: transform`。但在 Chrome 中，当父级 `AppCanvasWorkspace` 进行 `translate` 平移时，子级的 `will-change` 会导致合成层脱节，视觉上表现为选框残影。
- **真理**：移除了子级的 `will-change`，改用 `backface-visibility: hidden; transform-style: preserve-3d;` 来强制启用无副作用的 3D 加速层，既保证了性能，又消除了撕裂。

---

> **To 未来的重构者**：
> 这个页面是经历了无数次坐标系拉扯、性能抖动和交互冲突后沉淀下来的**最稳定形态**。
> 如果你要修改 `AppCanvasWorkspace` 的平移/缩放机制，**请务必严格回归测试本文档第 2 节和第 3 节的内容**！切记！
