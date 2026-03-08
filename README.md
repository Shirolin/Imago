# Imago - 现代化图像处理工具

Imago 是一款基于浏览器的、高性能且保护隐私的图像处理工具。所有操作均在本地完成，确保您的图片数据永不上传至服务器。

## 🚀 核心功能

- **本地压缩**：利用 Web Workers 实现高性能的图片压缩，支持 JPG、PNG、WebP 等格式。
- **批量处理**：支持一次性导入多张图片进行统一处理。
- **拖拽上传**：支持全局拖拽、点击选择及剪贴板粘贴（Ctrl+V）导入图片。
- **任务管理**：精细化的状态控制，支持随时中断（AbortController）及单个/批量移除。
- **实时预览**：在处理前后即时预览图片及压缩效果。

## 🛠️ 技术栈

- **框架**：Vue 3 (Composition API + `<script setup>`)
- **状态管理**：Pinia
- **路由**：Vue Router
- **样式**：Tailwind CSS + Radix Vue (基于 Shadcn UI 规范)
- **图标**：Lucide Vue Next
- **测试**：Vitest + Vue Test Utils + jsdom
- **核心算法**：browser-image-compression, exifr, jszip

## 🧪 自动化测试

项目已集成完整的自动化测试环境，确保核心逻辑的稳定性。

### 运行测试
执行所有单元测试和组件测试：
```bash
npm run test
```

### 交互式测试 (UI)
在浏览器中以图形界面查看测试进度和详细信息：
```bash
npm run test:ui
```

### 测试覆盖率
生成代码覆盖率报告，查看测试覆盖情况：
```bash
npm run test:coverage
```

## 📦 项目开发

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

### 类型检查与编译
```bash
npm run build
```

### 代码格式化与 Lint
```bash
npm run format  # 使用 Prettier
npm run lint    # 使用 ESLint
```

## 📄 许可协议

本项目基于 MIT 协议开源。
