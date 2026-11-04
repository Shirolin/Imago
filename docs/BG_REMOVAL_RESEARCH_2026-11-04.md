# Imago 抠图能力调研与优化（2026-11，已实施）

> 目标：对照 GitHub 上可用的抠图/分割方案，找出本项目抠图链路的质量、性能与合规短板，并给出可落地的优先级。
> 调研范围：`@imgly/background-removal`、BiRefNet 系列、RMBG、BEN2、MODNet、ISNet/U²-Net、SAM 2 / SAM 2.1、ViTMatte、SAM2Matting 等。
> 本文记录调研结论与已完成的改造；未完成项在路线图中标注。

## 0. 结论摘要

1. **公开基准里 BiRefNet-lite 在浏览器体积下明显强于 ISNet**：边缘 F 值 0.988 vs 0.947，边缘带误差 0.044 vs 0.057。BiRefNet-lite fp16 约 123MB，比原 ISNet 全量 176MB 更小，且为 MIT 许可。
2. **`@imgly/background-removal` 是 AGPL-3.0，而本项目是 GPL-3.0-only**。把 AGPL 代码打进产物后，整体只能按 AGPL 分发。已移除 imgly：轻量档换 ORMBG（Apache-2.0，int8 42MB），专业档换 BiRefNet-lite（MIT）。
3. **已修掉三个确定性缺陷**：精修滑杆实际无效（`contrast/brightness` 不作用于 alpha）、预缩放 2048 超过模型原生 1024、JPEG 导出把透明区压成黑底。
4. **SAM 2 是"分割"不是"抠图"**：Sigmoid 输出是前景概率，不是物理 alpha。已加导向滤波做低成本边缘对齐；毛发/半透明材质的下一步仍是 trimap + 抠图模型（ViTMatte/SAM2Matting）。
5. **交互式 SAM 的三项低成本增量已落地**：升级 SAM 2.1 tiny（同体积）、WASM 下优先 int8（视觉编码器 64MB → 50MB）、三候选掩码暴露给用户切换。

## 1. 现状盘点（改造后）

| 模式       | 实现                                             | 模型/依赖                      | 体积                                | 许可       |
| ---------- | ------------------------------------------------ | ------------------------------ | ----------------------------------- | ---------- |
| 色值       | `matchWorker.ts` CIELAB 距离 + 去污染/去溢色     | 自研                           | 0                                   | 项目自身   |
| 轻量（AI） | `bgRemove.worker.ts` → Transformers.js pipeline  | ORMBG（ISNet 架构再训练）      | WebGPU fp16 84MB / WASM q8 42MB     | Apache-2.0 |
| 专业（AI） | `bgRemove.worker.ts` → Transformers.js AutoModel | BiRefNet-lite（WebGPU 重写图） | WebGPU fp16 123MB / WASM fp32 245MB | MIT        |
| 交互式     | `sam2.worker.ts` → Transformers.js               | SAM2 Hiera-Tiny ONNX           | fp16 64MB / fp32 128MB 视觉编码器   | Apache-2.0 |

关键代码位置：

- `src/lib/engines/bgRemove.worker.ts` AI 模型加载、推理、遮罩精修
- `src/lib/engines/maskRefine.ts` alpha 空间精修
- `src/lib/engines/guidedMaskRefine.ts` 交互式遮罩的引导滤波
- `src/lib/engines/bgRemoveEngine.ts` Worker 生命周期与预加载
- `src/lib/engines/sam2.worker.ts:16` 模型 ID
- `src/lib/engines/sam2.worker.ts` 三候选掩码 + 引导精修
- `src/lib/engines/matchWorker.ts` 色值距离 + 连通性约束

## 2. 代码审计发现

### 已修复

| 问题                                                    | 影响                                                                                   | 修复                                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `mCtx.filter = blur(...) contrast(...) brightness(...)` | Canvas filter 只改 RGB，不改 alpha。**「判定强度」「边缘收缩」两个滑杆对遮罩完全无效** | 新增 `maskRefine.ts`，在 alpha 空间做对比度/重映射，再放大                 |
| 预缩放上限 2048                                         | 模型固定 1024×1024 推理，2048 只是多一次大图重采样                                     | `MAX_INFERENCE_DIMENSION` 改为 1024                                        |
| 导出格式可选 JPEG                                       | JPEG 无 alpha，透明区域会被压成黑色                                                    | `AppExportSettings` 增加 `excludeFormats`，抠图页隐藏 JPEG                 |
| `@imgly` AGPL 依赖                                      | 与项目 GPL-3.0-only 冲突                                                               | 移除依赖，改用 Apache-2.0 的 ORMBG + MIT 的 BiRefNet-lite                  |
| 「禁用预缩放（高精度）」是伪选项                        | 模型输入固定 1024，关闭预缩放不增加细节，只增加解码内存                                | 移除该开关                                                                 |
| SAM2 无 WebGPU 时加载 fp32                              | 视觉编码器 128MB，CPU 设备下载过重                                                     | 升级 SAM 2.1 tiny，WASM 优先 int8（约 58MB），失败回退 fp32                |
| BiRefNet 原版在 WebGPU 上直接报错                       | `Split` 节点需要 17 个 storage buffer，超过 Dawn 上限 16，推理失败                     | 改用 `wonfy/BiRefNet_lite-ONNX-webgpu`（Split/Concat 拆树，MIT，权重不变） |
| 交互式合成只读遮罩 R 通道                               | 白色 RGB + 软 Alpha 的遮罩会被压成硬边，精修完全不可见                                 | alpha = 遮罩灰度 × 遮罩 Alpha，兼容旧式不透明灰度遮罩                      |
| 色值模式误删前景同色区域                                | 白衬衫配白墙时衣服内部被一起抠掉                                                       | 新增「仅移除连通背景」开关，从四边 flood fill 后取交集                     |
| 非方形图被拉伸到 1024×1024                              | 宽幅/竖幅图的物体比例失真，边缘质量下降                                                | `letterbox.ts`：等比缩放 + 边缘延展留白，推理后按内容矩形裁回              |
| 交互式遮罩先还原到原图尺寸                              | 大图会生成 3 份原尺寸浮点遮罩（12MP 约 150MB），随后又缩到 1024                        | 直接还原到 ≤1024 的目标尺寸；`binarize:false` 保留 logits 供 Sigmoid 使用  |

### 仍待处理

1. **SAM2 的边缘仍不是物理 alpha**：引导滤波只能对齐已有软边，毛发/薄纱/玻璃这类真正的半透明材质仍需 trimap + 抠图模型（ViTMatte/SAM2Matting）。

## 3. GitHub 生态对比

### 3.1 自动抠图（非交互）

| 方案              | 仓库/来源                                                   | 许可               | 浏览器可用性                                                    | 体积                    | 评价                                            |
| ----------------- | ----------------------------------------------------------- | ------------------ | --------------------------------------------------------------- | ----------------------- | ----------------------------------------------- |
| ISNet             | imgly / rembg                                               | Apache-2.0（权重） | ✅ 现用                                                         | 40/80/176MB             | 稳定，边缘一般                                  |
| **BiRefNet-lite** | `ZhengPeng7/BiRefNet` / `onnx-community/BiRefNet_lite-ONNX` | **MIT**            | ✅ Transformers.js / ORT Web（原版 WebGPU 需重写 Split/Concat） | fp16 123MB / fp32 245MB | **当前最佳性价比**，边缘明显优于 ISNet          |
| BiRefNet 全量     | 同上                                                        | MIT                | ⚠️ 内存压力大                                                   | fp16 467MB              | 质量最高一档，浏览器不划算                      |
| RMBG-2.0          | `Bria-AI/RMBG-2.0`                                          | CC BY-NC 4.0       | ⚠️                                                              | —                       | 质量接近 BiRefNet，**禁止商用**                 |
| BEN2              | `PramaLLC/BEN2` / `onnx-community/BEN2-ONNX`                | MIT（base）        | ✅                                                              | fp16 209MB              | 毛发强，但体积大、边缘分低于 BiRefNet-lite      |
| MODNet            | `Xenova/modnet`                                             | Apache-2.0         | ✅                                                              | ~25MB                   | 仅人像，非通用                                  |
| U²-Net            | rembg                                                       | Apache-2.0         | ✅                                                              | 4.7/176MB               | 通用但偏硬掩码                                  |
| ORMBG             | rembg                                                       | Apache-2.0         | ✅                                                              | int8 44MB               | 小体积兜底，边缘 0.952                          |
| rembg             | `danielgatis/rembg`                                         | MIT                | ❌ Python                                                       | —                       | 能力全集与后处理参考实现                        |
| rembg-web         | `bunn-io/rembg-web`                                         | MIT                | ✅                                                              | 跟随模型                | ORT Web 的 TS 移植，可参考模型加载              |
| rembg-webgpu      | `Remove-Background-ai/rembg-webgpu`                         | 未核实             | ✅                                                              | —                       | WebGPU 优先，可参考后端切换                     |
| bg0               | `opencoredev/bg0`                                           | Apache-2.0         | ✅                                                              | BiRefNet                | 现成的 BiRefNet 浏览器封装，含 WebGPU→WASM 回退 |

### 3.2 交互式分割 / 抠图

| 方案             | 说明                                        | 浏览器可行性                                    |
| ---------------- | ------------------------------------------- | ----------------------------------------------- |
| SAM 2 / 2.1 tiny | 现用架构；2.1 同体积、小目标更好            | ✅ 直接换模型 ID                                |
| HQ-SAM / SAM-HQ  | 边缘更细，但无现成浏览器 ONNX               | ⚠️                                              |
| ViTMatte-small   | trimap → alpha matte，MIT，ONNX 约 109MB    | ⚠️ 社区 ONNX 维护度低，Transformers.js 无原生类 |
| SAM2Matting      | ECCV 2026，SAM2/SAM3 + matting head，端到端 | ❌ 权重 215MB+，暂无浏览器导出                  |
| Matting Anything | SAM + matting，研究向                       | ❌                                              |

### 3.3 公开基准（Buffermint，8 张带 GT 的图）

| 模型                   | 许可       | Mask IoU | Boundary F | 边缘带误差 | 浏览器              |
| ---------------------- | ---------- | -------- | ---------- | ---------- | ------------------- |
| IS-Net                 | Apache-2.0 | 0.987    | 0.947      | 0.057      | ✅                  |
| BiRefNet general       | MIT        | 0.995    | 0.990      | 0.038      | ⚠️ 467MB            |
| **BiRefNet-lite int8** | MIT        | —        | **0.988**  | **0.044**  | ✅ 68MB，12MP 约 2s |
| RMBG-2.0               | CC BY-NC   | 0.995    | 0.991      | 0.041      | ⚠️ 内存             |
| BEN2 base fp16         | MIT        | —        | 0.977      | 0.068      | ✅ 219MB            |
| ORMBG int8             | Apache-2.0 | —        | 0.952      | 0.066      | ✅ 44MB             |

> 注意：`onnx-community/BiRefNet_lite-ONNX` 目前只发布了 fp16/fp32，没有 int8。68MB 的 int8 需要自行量化，或直接使用 bg0 锁定的构建。

## 4. 落地路线

### 已完成

- 修好 alpha 精修链路（`src/lib/engines/maskRefine.ts`）。
- 预缩放降到 1024，移除「禁用预缩放」伪选项。
- 抠图页隐藏 JPEG 导出。
- 移除 `@imgly/background-removal`，自动抠图统一走 Transformers.js：
  - 轻量档 → `onnx-community/ormbg-ONNX`（Apache-2.0，WebGPU fp16 84MB / WASM q8 42MB）。
  - 专业档 → `wonfy/BiRefNet_lite-ONNX-webgpu`（MIT，WebGPU fp16 123MB / WASM fp32 245MB）。原 `onnx-community` 导出在 WebGPU 上因 `Split` 需要 17 个 storage buffer（Dawn 上限 16）必然失败；该重写版把 Split/Concat 拆成 ≤6 输入的小树，权重与数学不变，CPU 输出与原版完全一致。
  - 模型在共享 Worker 内预加载，WebGPU 不可用时自动回退 WASM。
  - 同步更新 `package.json`、`pnpm-lock.yaml`、`package-lock.json`。
- SAM 2 → SAM 2.1 tiny（同体积、API 不变）；WASM 分支优先 int8，失败自动回退 fp32。
- 交互式下载的同意标记升到 v3，避免旧模型缓存被误判为已就绪。
- 交互式分割输出三个候选掩码（含预测 IoU），界面缩略图切换；切换结果会作为下一次点选的 mask feedback。
- 交互式边缘精修：`guidedMaskRefine.ts` 在 ≤1024 的引导图尺度上做导向滤波，只改 0.02–0.98 的未知带，实心前景与纯背景不动。合成时用「遮罩灰度 × 遮罩 Alpha」，修复此前只读 R 通道导致软边被压成硬边的问题。
- 色值模式新增「仅移除连通背景」开关：从四边对背景候选做 flood fill，与色距结果取交集，前景内部的同色区域不再被误删。
- 自动抠图改为 letterbox 输入：等比缩放 + 边缘延展留白到 1024×1024，推理后按内容矩形裁回，非方形图不再被拉伸。
- 交互式遮罩直接还原到 ≤1024：大图省掉 3 份原尺寸浮点遮罩的内存与耗时；同时修正 `post_process_masks` 默认二值化导致的「前景只有 73% 不透明」问题（改为 `binarize:false` 保留 logits）。

### 待实施

1. **trimap + 抠图模型**
   - 当前导向滤波只能对齐已有软边，不能凭空生成发丝级 alpha。更高成本路线是 trimap + ViTMatte-small（109MB）；社区 ONNX 维护度低，建议等官方导出或走服务端。
   - 与用户预期对齐：SAM 2 的输出仍应标注为「分割」。

## 5. 验收方法

- 固定一组难图：卷发人像、玻璃杯、纱网、毛绒玩具、白底白衬衫、产品硬边。
- 看三个指标：边缘放大 200% 的锯齿/断丝、背景残留、前景误删。
- 同一张图对比：ORMBG q8、BiRefNet-lite fp16、SAM 2.1 + 导向滤波。
- 记录：首次下载体积、WASM/WebGPU 各自耗时、峰值内存（Chrome Performance）。

## 6. 参考

- [imgly/background-removal-js](https://github.com/imgly/background-removal-js)（AGPL-3.0，已移除）
- [onnx-community/ormbg-ONNX](https://huggingface.co/onnx-community/ormbg-ONNX)（Apache-2.0，int8 42MB）
- [onnx-community/BiRefNet_lite-ONNX](https://huggingface.co/onnx-community/BiRefNet_lite-ONNX)（MIT，原版导出，WebGPU 上 Split 超限）
- [wonfy/BiRefNet_lite-ONNX-webgpu](https://huggingface.co/wonfy/BiRefNet_lite-ONNX-webgpu)（MIT，WebGPU 兼容重写，现用）
- [ZhengPeng7/BiRefNet](https://github.com/ZhengPeng7/BiRefNet)（MIT）
- [Bria-AI/RMBG-2.0](https://github.com/Bria-AI/RMBG-2.0)（CC BY-NC 4.0）
- [onnx-community/BEN2-ONNX](https://huggingface.co/onnx-community/BEN2-ONNX)（MIT，fp16 209MB）
- [opencoredev/bg0](https://github.com/opencoredev/bg0)（Apache-2.0，BiRefNet + WebGPU/WASM 回退）
- [bunn-io/rembg-web](https://github.com/bunn-io/rembg-web)（MIT）
- [danielgatis/rembg](https://github.com/danielgatis/rembg)（MIT，含 alpha matting 后处理参考）
- [onnx-community/sam2.1-hiera-tiny-ONNX](https://huggingface.co/onnx-community/sam2.1-hiera-tiny-ONNX)
- [SAM2Matting](https://arxiv.org/html/2606.27339v1)（ECCV 2026，trimap-free matting 方向）
- [Buffermint: 6 个开源模型浏览器实测](https://buffermint.com/articles/remove-background-browser-models)
- [LoftTools: BiRefNet vs RMBG vs MODNet](https://lofttools.com/blog/browser-background-removal-models/)
- [ComfyUI 30 路去背横评](https://tingyudeco.com/blog/comfyui-background-removal-30-way-comparison)
- [BG0 关于 Transformers.js 4.3 加载队列的提示](https://bg0.dev/docs/library)
