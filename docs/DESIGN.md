# Imago 设计文档

本文档记录了 Imago 项目的架构设计、技术选型及核心设计理念，旨在指导后续开发并确保 UI/UX 的一致性。

## 1. 核心理念

### 1.1 隐私优先 (Privacy First)
所有图像处理逻辑均在客户端浏览器中完成。利用浏览器原生的 `Canvas API`、`Web Workers` 以及 `browser-image-compression` 等库，确保用户数据永不上传至服务器。

### 1.2 现代响应式排版 (Modern Responsive Typography)
项目超越了传统的媒体查询（Media Queries），采用了**内容驱动 (Content-Driven)** 的设计模式：
- **容器查询 (@container)**：组件的样式（如字体大小、间距）取决于其父容器的宽度，而非视口宽度。这确保了组件在各种网格布局（Grid）和布局插槽（Slots）中均能自适应。
- **流体排版 (Fluid Typography)**：广泛使用 CSS `clamp()` 函数实现字体的平滑缩放，消除断点切换时的视觉跳跃。
- **文本平衡 (Text Balance)**：应用 `text-wrap: balance` 自动优化多行标题的断行，防止出现孤行（Orphans），提升多语言环境下的视觉和谐度。
- **i18n 友好**：通过 `hyphens: auto` 和严格的弹性盒模型（Flexbox）控制，确保长单词语言（如德语）或高密度语言（如中文）在窄屏下均不撑破布局。

## 2. 技术栈

- **视图层**：Vue 3 (Composition API + `<script setup>`)
- **状态管理**：Pinia (采用组合式 Store 模式)
- **样式引擎**：Tailwind CSS (JIT 模式)
- **底层原语**：Radix Vue (提供 Headless UI 支持，确保无障碍 A11y)
- **测试框架**：Vitest (单元测试与逻辑校验)
- **打包工具**：Vite

## 3. 架构分层

### 3.1 原子组件 (UI Primitives)
路径：`src/components/ui`
- 基于 **Shadcn** 模式，结合 `class-variance-authority` (CVA) 管理组件变体（Variant）。
- 仅处理交互逻辑与基础样式，不包含业务逻辑。

### 3.2 业务通用组件 (Common Components)
路径：`src/components/common`
- 如 `ImageCard`、`ImageUpload`。
- 封装了特定的业务交互（如拖拽上传、进度显示），通过插槽（Slots）提供扩展性。
- **必须遵循容器查询设计规范。**

### 3.3 布局系统 (Layout System)
路径：`src/components/layout`
- `WorkspaceLayout`：定义了统一的头部工具栏、侧边栏和主内容区。
- 利用 `Teleport` 将各视图的特定操作按钮传送至顶栏统一展示。

## 4. 状态流转与资源管理

### 4.1 图片生命周期
1. **导入**：通过 `addImages` 生成唯一 ID，创建 `Blob URL` 用于预览。
2. **处理**：在 Store 中标记 `status: 'processing'`。对于耗时操作，必须关联 `AbortController` 以支持用户取消任务。
3. **完成**：更新 `processedBlob` 并计算节省空间。
4. **清理**：在移除图片或清空队列时，显式调用 `URL.revokeObjectURL` 释放浏览器内存，并触发 `AbortController.abort()` 停止后台计算。

## 5. 扩展规范

- **新增功能视图**：需继承 `WorkspaceLayout`，并将特定控制项（如滑动条、开关）放置在 `sidebar` 或传送至 `header`。
- **样式编写**：优先使用 Tailwind 类。对于复杂的流体数值，推荐在 `style` 标签中使用 `clamp()` 并配合 `cqw` 单位。
- **i18n 适配**：所有硬编码字符串应具备良好的换行包容性，避免固定宽高的容器。
