# AI Agent 质量协议 (Agent Protocol)

为了确保项目的代码质量和工程稳定性，所有 AI Agent 在参与本项目开发时必须严格遵守以下规则：

## 1. 核心指令

### 修改后必查
在请求 Commit 代码或完成任务前，Agent **必须**在根目录运行：
```bash
npm run validate
```
该命令会并行运行 lint 校验、类型检查和单元测试。

### 错误自愈 (Self-Healing)
如果 `npm run validate` 报错，Agent **必须**：
1. 读取完整的报错信息。
2. 分析报错原因并直接在源代码中修复。
3. 重新运行校验直到通过。
**严禁**使用 `--no-verify` 绕过 Git 钩子。

## 2. 工程规范

### 任务解耦
- **禁止**在 `build` 命令中添加任何校验逻辑（lint/type-check）。校验应由 `validate` 命令或 Git 钩子独立完成。
- **构建命令**仅负责产出产物：`npm run build`。

### 防线机制
1. **第一层 (Pre-commit)**：针对暂存区文件自动执行 `eslint --fix` 和 `prettier --write`。Agent 只需关注逻辑，格式问题由钩子自动处理。
2. **第二层 (Pre-push)**：针对全量逻辑执行 `npm run validate`。确保 AI 产生的代码在全局范围内没有类型冲突或逻辑断裂。

## 3. 环境一致性
- 保持校验工具版本一致。
- 严禁校验构建产物目录（如 `dist/`, `.next/`, `out/` 等）。

---
🚀 *遵守协议，构建可靠的 AI 协作流。*
