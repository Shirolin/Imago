# Imago 架构与设计深度白皮书

本文档旨在为 Imago 提供一份全面的、具备架构师视角的系统设计说明，涵盖从底层基础设施到上层业务逻辑的每一处设计细节。

---

## 1. 核心设计哲学 (Design Philosophy)

### 1.1 客户端优先与零服务器依赖 (Client-First & Zero-Server)
Imago 的首要目标是提供一个**完全在用户本地运行**的图像处理套件。
- **隐私性**：通过将所有计算（压缩、剪切、滤镜等）保留在浏览器内存中，消除了数据在传输过程中的泄露风险。
- **响应速度**：由于不存在网络上传与下载的延迟，处理过程仅受限于用户的 CPU/GPU 性能，极大提升了反馈速度。

### 1.2 内容驱动的现代排版 (Content-Driven Typography)
超越了传统的 Breakpoints 设计，Imago 采用了一套**自适应容器规范**：
- **解耦视口**：组件（如 `ImageCard`）不再依赖窗口宽度，而是基于 `@container` 实现自感应。这允许同一个组件在网格系统、弹窗或侧边栏中无缝迁移。
- **流体插值**：利用 CSS `clamp()` 实现在各种屏幕密度和尺寸下的平滑过渡，确保在 iPad 到 4K 显示器上均有一致的视觉重心。
- **排版平衡**：强制应用 `text-wrap: balance` 和 `hyphens: auto`，解决了 i18n 化后不同语种长短不一导致的 UI 破坏。

---

## 2. 系统架构与数据流 (System Architecture & Data Flow)

### 2.1 集中化状态管理 (State Management with Pinia)
项目采用 Pinia 作为单一事实来源（SSOT），其核心 Store (`imageStore.ts`) 设计如下：
- **状态树设计**：`ImageItem` 接口完整记录了图片的生命周期状态（`idle` -> `processing` -> `done`/`error`）。
- **响应式派生**：通过 `computed` 实现全局进度（`globalProgress`）、选择统计（`selectedCount`）等派生状态，驱动 UI 实时刷新。
- **资源清理策略**：Store 不仅管理数据，还负责显式调用 `URL.revokeObjectURL`。在 Vue 组件卸载或图片删除时，强制回收 Blob 内存，防止长会话导致的内存泄漏。

### 2.2 异步任务调度 (Async Task Scheduling)
针对密集型图像处理，Imago 建立了一套**可中断的并行任务流**：
- **并发控制**：在视图层（如 `CompressView`）利用 `Promise.all` 配合 Store 更新，实现多张图片的并行处理。
- **任务取消机制 (AbortController)**：每个处理任务均关联一个 `AbortController`。
  - 用户手动删除正在处理的图片时，立即触发 `abort()` 停止 Web Worker 任务。
  - 切换路由或清空列表时，全局清理所有挂起任务，释放系统资源。
- **Web Worker 分流**：底层库（如 `browser-image-compression`）在处理时会自动开启 Web Worker，确保主线程 UI 不出现任何掉帧或阻塞。

---

## 3. 技术基础设施 (Technical Infrastructure)

### 3.1 样式引擎与组件原语
- **Tailwind CSS + shadcn/ui**：通过 `src/lib/utils.ts` 中的 `cn()` 函数，实现动态类名的智能合并（解决了 Tailwind 类冲突问题）。
- **Radix Vue**：提供底层交互原语（Accessible Primitives），确保复杂组件（如对话框、弹出层）在具备极致视觉效果的同时，完美支持键盘导航和屏幕阅读器。

### 3.2 工程化保障
- **路径别名**：通过 Vite 配置 `@/` 指向 `src/`，极大简化了深层嵌套目录下的模块引用。
- **自动化测试**：利用 **Vitest + jsdom** 模拟浏览器环境。重点覆盖：
  - Store 的状态流转逻辑。
  - 文件处理辅助函数（`useFileHelpers`）的准确性。
  - 组件的渲染与交互分支。

---

## 4. UI/UX 深度交互模式 (UX Interaction Patterns)

### 4.1 传送门操作模式 (The Teleport Pattern)
为了保持界面的专注与极简，Imago 采用了一种特殊的布局交互模式：
- **视图解耦**：各功能页面（Compress, Crop, etc.）定义自己的操作逻辑（如滑动条）。
- **全局 Header 集成**：通过 `<Teleport to="#top-bar-tools">`，各页面将核心动作（Action）推送到主 Header 的固定区域。这使得用户在滚动主内容区时，关键操作始终触手可及。

### 4.2 视觉反馈链路
- **骨架屏与占位图**：预览图加载完成前，通过渐进式滤镜和背景占位提升视觉稳定性。
- **任务进度联动**：页面顶部进度条 + Header 状态胶囊 + ImageCard 处理状态。三位一体的反馈链路确保用户对当前系统的运行状态了如指掌。

---

## 5. 健壮性与错误处理 (Resilience)

### 5.1 边界情况处理
- **重复上传过滤**：基于文件名、大小和修改时间的哈希指纹校验，自动过滤队列中的重复文件。
- **超大文件预警**：内置 50MB 拦截机制，防止用户上传极端尺寸图片导致浏览器崩溃（Crash）。
- **优雅降级**：当压缩后体积大于原图时，自动跳过处理并保留原图，并在 UI 上通过“已跳过”标签告知用户，而非显示虚假的“压缩成功”。

### 5.2 状态隔离
- 每个图片处理任务拥有独立的 `AbortController` 和错误状态（`error` 字段），单张图片处理失败不会影响队列中其他图片的进度。
