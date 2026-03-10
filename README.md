<div align="center">

<img src="https://github.com/Shirolin/Imago/blob/main/public/vite.svg" width="128" height="128" alt="Imago Logo" />

# Imago

**现代化图像处理工具 · 高性能 · 隐私至上**

[![License](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Vue](https://img.shields.io/badge/Vue-3.x-4fc08d.svg)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646cff.svg)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)

[简体中文](README.md) | [English](README_EN.md)

</div>

---

## ✨ 项目简介

**Imago** 是一款专为创作者和极客打造的浏览器端图像处理工具。它集成了压缩、裁剪、滤镜、EXIF 清理等核心功能，所有操作均在**本地浏览器内核**中完成，确保您的隐私数据永不上传至任何服务器。

> [!IMPORTANT]
> **隐私核心：** Imago 采用 "Local-First" 设计理念，通过 Web Workers 技术在本地处理图片，甚至在离线状态下也能完美运行。

---

## 🚀 核心亮点

| 功能模块 | 说明 | 演示 |
| :--- | :--- | :--- |
| **智能压缩** | 支持 JPG/PNG/WebP 格式，在保持画质的同时极大缩小文件体积。 | [🎬 演示占位] |
| **EXIF 管理** | 深度擦除或查看图片的元数据（GPS、拍摄设备等），保护社交隐私。 | [🎬 演示占位] |
| **批量处理** | 支持多图导入、统一配置、一键导出，极大提升处理效率。 | [🎬 演示占位] |
| **极速预览** | 基于 GPU 加速的实时预览，即刻感知处理后的视觉效果。 | [🎬 演示占位] |

---

## 🛠️ 功能详解

### 📦 核心工具集
- **本地压缩**：利用 `browser-image-compression` 实现多线程高性能压缩。
- **EXIF 清理**：基于 `exifr` 深度解析并清理图片敏感信息。
- **裁剪与缩放**：自定义比例裁剪，支持按宽度/高度/百分比智能缩放。
- **高级滤镜**：预设多种艺术滤镜，一键提升图片质感。
- **任务管理**：支持随时中断任务（AbortController），灵活管理处理队列。

### 🎨 交互体验
- **拖拽式上传**：支持全局拖拽、文件夹拖拽及剪贴板粘贴导入。
- **暗黑模式**：原生支持现代化的 UI 设计语言，适配各种系统主题。
- **响应式设计**：完美适配移动端与 PC 端。

---

## ⚙️ 开发与构建

### 部署指南
我们推荐使用 **Cloudflare Pages** 进行自动化部署。详细配置请参考：[🚀 部署指南 (CI/CD)](docs/DEPLOYMENT.md)

### 技术栈
- **核心框架**：Vue 3 (Composition API)
- **构建工具**：Vite
- **状态管理**：Pinia
- **UI 组件库**：Radix Vue + Tailwind CSS (Shadcn UI Style)
- **图标库**：Lucide Vue Next
- **自动化测试**：Vitest + Vue Test Utils

### 本地运行
1. **克隆仓库**
   ```bash
   git clone https://github.com/Shirolin/Imago.git
   cd Imago
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

4. **构建生产版本**
   ```bash
   npm run build
   ```

---

## 🧪 质量保证

我们通过严谨的测试流程确保工具的稳定性：

- **单元测试**：`npm run test`
- **交互测试 (UI)**：`npm run test:ui`
- **覆盖率报告**：`npm run test:coverage`

---

## 🤝 贡献与支持

### 欢迎贡献
如果您有任何改进建议或发现了 Bug，欢迎：
- [提交 Issue](https://github.com/Shirolin/Imago/issues) 报告 Bug 或提出新功能需求。
- 提交 [Pull Request](https://github.com/Shirolin/Imago/pulls) 贡献代码。
- 参与讨论，分享您的使用心得。

### 支持项目
如果您觉得 **Imago** 对您有所帮助，请考虑：
- 给项目点一个 **Star** ⭐ 以表鼓励。
- 将它分享给更多需要处理图像的朋友。
- 如果您觉得这个项目非常有价值，也可以通过 [Buy Me a Coffee](https://www.buymeacoffee.com/shirolin) 为我买杯咖啡。

---

## 📄 许可协议
本项目采用 [GNU General Public License v3.0](LICENSE) 协议。

[Shirolin](https://github.com/Shirolin) © 2026
