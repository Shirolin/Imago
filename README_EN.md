<div align="center">

<img src="https://github.com/Shirolin/Imago/blob/main/public/vite.svg" width="128" height="128" alt="Imago Logo" />

# Imago

**Modern Image Processing Toolkit · High-Performance · Privacy-First**

[![License](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Vue](https://img.shields.io/badge/Vue-3.x-4fc08d.svg)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646cff.svg)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)

[简体中文](README.md) | [English](README_EN.md)

</div>

---

## ✨ Introduction

**Imago** is a professional browser-based image toolkit for creators and geeks. It features high-performance compression, smart cropping, artistic filters, and EXIF cleaning. All operations are performed **locally within your browser**, ensuring your private data never leaves your device.

> [!IMPORTANT]
> **Privacy-First:** Imago is designed with a "Local-First" philosophy. Powered by Web Workers, it processes images locally and works perfectly even offline.

---

## 🚀 Key Highlights

| Module | Description | Demo |
| :--- | :--- | :--- |
| **Smart Compression** | Supports JPG/PNG/WebP formats. Drastically reduces file size while maintaining visual quality. | [🎬 Demo Placeholder] |
| **EXIF Management** | Strip or view image metadata (GPS, device info, etc.) to protect your social privacy. | [🎬 Demo Placeholder] |
| **Batch Processing** | Multi-image import, unified configuration, and one-click export for maximum efficiency. | [🎬 Demo Placeholder] |
| **Instant Preview** | GPU-accelerated real-time previews to see visual effects instantly. | [🎬 Demo Placeholder] |

---

## 🛠️ Features

### 📦 Core Toolkit
- **Local Compression**: Multi-threaded high-performance compression using `browser-image-compression`.
- **EXIF Stripping**: Deep analysis and cleaning of sensitive image metadata powered by `exifr`.
- **Crop & Scale**: Custom aspect ratio cropping and smart scaling by width, height, or percentage.
- **Artistic Filters**: Built-in presets to instantly enhance image aesthetics.
- **Task Management**: Fine-grained control with task interruption support (AbortController).

### 🎨 Interaction & UX
- **Drag-and-Drop**: Supports global dragging, folder uploads, and clipboard pasting (Ctrl+V).
- **Dark Mode**: Modern UI design language with full system theme adaptation.
- **Responsive Design**: Optimized for both mobile and desktop environments.

---

## ⚙️ Development & Build

### Tech Stack
- **Framework**: Vue 3 (Composition API)
- **Build Tool**: Vite
- **State Management**: Pinia
- **UI Library**: Radix Vue + Tailwind CSS (Shadcn UI Style)
- **Icons**: Lucide Vue Next
- **Testing**: Vitest + Vue Test Utils

### Quick Start
1. **Clone the Repo**
   ```bash
   git clone https://github.com/Shirolin/Imago.git
   cd Imago
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Dev Server**
   ```bash
   npm run dev
   ```

4. **Build for Production**
   ```bash
   npm run build
   ```

---

## 🧪 Quality Assurance

We ensure stability through a rigorous testing process:

- **Unit Tests**: `npm run test`
- **Interactive UI Tests**: `npm run test:ui`
- **Coverage Report**: `npm run test:coverage`

---

## 🤝 Contribution & Support

### Welcome Contributions
If you have any suggestions for improvement or find any bugs, feel free to:
- [Submit an Issue](https://github.com/Shirolin/Imago/issues) to report bugs or suggest new features.
- Submit a [Pull Request](https://github.com/Shirolin/Imago/pulls) to contribute code.
- Join the discussion and share your experience.

### Support the Project
If you find **Imago** helpful, please consider:
- Giving the project a **Star** ⭐ as encouragement.
- Sharing it with more friends who need image processing.
- If you find this project very valuable, you can also [Buy Me a Coffee](https://www.buymeacoffee.com/shirolin).

---

## 📄 License
This project is licensed under the [GNU General Public License v3.0](LICENSE).

[Shirolin](https://github.com/Shirolin) © 2026
