# Cloudflare Pages 自动化部署指南 (CI/CD)

本方案采用 **Cloudflare 原生 Git 集成** 模式，具有零配置、高质量把控、完全免费的特点。适用于所有 Vite/Vue/React 等现代前端项目。

---

## 🚀 核心架构

该方案的核心思想是将“质量检查”与“生产构建”合并。Cloudflare 在构建时会按照以下顺序执行：
1. **代码格式检查** (Prettier) -> 失败则停止
2. **代码规范检查** (ESLint) -> 失败则停止
3. **类型检查** (TypeScript) -> 失败则停止
4. **生产环境打包** (Vite)

这样可以确保**只有完全合规的代码才会出现在生产环境**，且无需配置 GitHub Secrets。

---

## 📦 项目配置 (package.json)

在您的项目中，确保 `scripts` 包含以下组合：

```json
{
  "scripts": {
    "type-check": "vue-tsc -b",
    "lint:check": "eslint .",
    "format:check": "prettier --check \"src/**/*.{vue,ts,js,json,css,scss,md}\"",
    "build": "npm run format:check && npm run lint:check && npm run type-check && vite build"
  }
}
```

---

## 🛠️ Cloudflare 控制台配置

1. **登录 Cloudflare**：进入 **Workers 和 Pages** -> **创建应用程序**。
2. **选择 Pages 标签**：点击 **连接到 Git (Connect to Git)**。
3. **关联仓库**：选择 GitHub 上的目标仓库。
4. **构建设置 (重要)**：
   - **框架预设 (Framework preset)**：选择 `Vite`。
   - **构建命令 (Build command)**：`npm run build`。
   - **构建输出目录 (Build output directory)**：`dist`。
5. **保存并部署**：点击后，Cloudflare 将自动开始首次构建。

---

## ✅ 进阶功能：GitHub 状态集成

配置完成后，GitHub 将自动获得以下能力：
- **提交状态检查**：每次 Push 后，Commit 旁边会出现 🟡 (进行中)、✅ (通过) 或 ❌ (失败) 的图标。
- **部署预览**：在 Pull Request 中，Cloudflare 会自动生成一个临时的预览链接，方便测试。

---

## 💡 常见问题 (FAQ)

**Q: 为什么构建失败了？**
A: 请在本地运行 `npm run build`。由于我们将 Lint 和类型检查放进了构建过程，任何代码格式不规范或类型错误都会导致构建失败。修复这些问题后重新 Push 即可。

**Q: 需要设置 API Token 或 Account ID 吗？**
A: **不需要。** 只要使用“连接到 Git”模式，权限是自动绑定的。

---

[Shirolin](https://github.com/Shirolin) © 2026
