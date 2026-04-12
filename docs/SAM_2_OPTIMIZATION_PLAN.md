# SAM 2 交互式抠图功能优化实施计划

## 0. 文档归档 (Documentation)

**任务：** 将本实施计划归档至项目 `docs/` 目录中。
**文件：** `docs/SAM_2_OPTIMIZATION_PLAN.md`
**操作：** 在实施阶段开始时，首先创建此文档，以便团队成员查阅。

## 1. 背景与目标 (Background & Motivation)

当前项目使用 `onnx-community/sam2-hiera-tiny-ONNX` 实现交互式抠图功能。用户反馈使用体验“逻辑怪怪的”且“边缘生硬”。经过技术研究报告的比对分析，问题根源在于 Worker 中的提示词（Prompt）坐标映射未经过官方标准的预处理管线（丢失了 Padding 偏移），同时结果遮罩采用了硬阈值二值化导致锯齿，以及多点交互时状态反馈机制不够稳定。
**目标：** 重构 `sam2.worker.ts` 中的解码推理链路，彻底修复点击偏移问题，引入 Alpha 平滑提升边缘质量，并优化掩码反馈循环，实现丝滑、精准的交互体验。

## 2. 影响范围 (Scope & Impact)

- **核心文件：** `src/lib/engines/sam2.worker.ts`
- **关联文件（可能需要微调）：** `src/components/InteractiveEditorModal.vue`（确保传入 Worker 的归一化坐标逻辑与 Worker 的计算逻辑完美闭环）
- **影响：** 仅影响“交互式抠图 (SAM 2)”功能，不影响其他自动去背引擎 (Match/Smart/Pro)。

## 3. 实施步骤 (Implementation Steps)

### 步骤 3.1: 修正 Prompt 坐标映射链路

将归一化坐标正确映射到模型的 `reshaped_input_sizes` 坐标系，手动构建 Tensor 传入模型。

- 在 `sam2.worker.ts` 的 `decode` 函数中，将 UI 传入的归一化坐标 `[0, 1]` 直接乘以 **`lastProcessorInputs.reshaped_input_sizes`**（即图像经等比例缩放后、Padding 前的实际像素尺寸），转换为模型期待的坐标。
- **不应**乘以 `original_sizes`（原图尺寸）——模型的坐标空间是 reshaped 空间，而非原图空间。
- **不应**调用 `processor(null, { input_points: ... })`：Transformers.js 的 `Sam2Processor` 在分离式 encode/decode 架构下，decode 阶段调用 `processor(null, ...)` 会因缺少图像处理上下文而抛出 `TypeError: undefined is not iterable` 及 `Invalid rank` 错误，该路线在此模型上不可行。
- 手动构建 `input_points` 与 `input_labels` 的 `Tensor`，与 `imageEmbeddings` 合并后传入模型 `forward` 方法，是当前环境下数学等价且唯一可用的实现路径。

### 步骤 3.2: 引入 Sigmoid 连续 Alpha 平滑

抛弃当前的硬阈值裁剪（`> 0 ? 255 : 0`）。

- 解析 `post_process_masks` 返回的高分辨率 Logits 数据。
- **背景零截断 (Zero-Clamping)**：为了防止背景区域（Logit <= 0）因公式计算产生微弱 Alpha 导致全图背景变蓝，必须引入硬性决策边界。**仅对 $Logit > 0$ 的前景像素应用 Sigmoid 映射，其余非空洞背景像素 Alpha 强制设为 0。**
- 应用 Sigmoid 函数：$Alpha = \frac{1}{1 + e^{-logit}}$。
- 将连续的浮点 Alpha 值映射到 `0-255`，实现边缘**抗锯齿（Anti-aliasing）**效果，使边界过渡更平滑自然。
- 修改现有的形态学 `fillHoles` 算法，使其在平滑后的 Alpha 通道上仍能正确识别绝对背景（如 Alpha 非常低的值）并进行填洞。对于识别出的内部空洞噪声，强制 Alpha 设为 255。

### 步骤 3.3: 优化掩码反馈记忆（Mask Feedback Loop）

增强多点连续点击时的稳定性。

- 获取当前解码过程最优输出的 `low_res_masks`。
- 在下一次用户点击时，将上一次的 `low_res_masks` 传给模型作为 `mask_input`，并将 `has_mask_input` 设为 `1`。
- 确保用户点击“清空标注”时，同步清空缓存的 `mask_input`。

## 4. 验证与测试 (Verification & Testing)

1. **坐标对齐测试：** 导入非正方形图片（例如 16:9 或 9:16），在极其边缘的细节处点击，验证遮罩是否精准生成在鼠标指针正下方，无任何位移。
2. **边缘平滑度测试：** 抠取含有绒毛或圆润边缘的物体，放大查看导出的 PNG 图像，验证边缘是否呈现平滑的半透明过渡，无明显“狗牙”锯齿。
3. **交互连贯性测试：** 连续进行正向点击（保留）和负向点击（剔除），观察每次点击后遮罩是否平稳过渡，不出现大面积的意外坍缩或跳变。

## 5. 回滚策略 (Migration & Rollback)

由于修改集中在 `sam2.worker.ts` 内的局部逻辑，若优化后出现不可预期的严重性能倒退或功能崩溃，可通过 Git 历史直接还原 `sam2.worker.ts` 文件即可恢复到现有版本。
