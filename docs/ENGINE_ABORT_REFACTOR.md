# 引擎内核深化与浏览器验收

本文记录 2026-10-06 的一轮代码审视：从 `useToolRun` 深化开始，经引擎中止语义收口、补齐引擎测试，到11 个视图与 12 个引擎的完整浏览器验收。

包含 **6 个真实缺陷的修复**，以及 **4 项经核实后主动放弃的重构**（附放弃理由，避免后来者重复评估）。

---

## 一、背景

`useToolRun` 把七个工具视图里逐字重复的「本地结果容器 + CTA 状态机 + 导出」逻辑收进一个深模块后，暴露出几个此前不可见的问题：

- 部分视图的「处理中可中止」是**界面承诺与实现不符**——按钮可点，点了没反应
- 引擎的中止写法有三种并存，上层只能靠字符串匹配识别
- 三个主引擎零测试

这些缺陷编译、`type-check`、既有测试全绿都发现不了——它们的失效路径在交互层与组件契约的缝隙里。

---

## 二、6 个真实缺陷及修复

### 1. crop / filter 的 abort 监听器泄漏

```ts
// 修复前：匿名监听器，从不 removeEventListener
options.signal.addEventListener('abort', () => {
  img.src = ''
  reject(new Error('Task aborted'))
})
```

闭包捕获整个 promise 作用域（`img` / `resolve` / `reject` 全部被钉住无法回收）。批量处理 100 张 = 100 个泄漏。

**修复**：引入 `lib/engines/abort.ts` 的 `onAbort()`，返回幂等解绑函数。

### 2. `useImageProcessor` 靠字符串匹配识别中止

```ts
// 修复前
err.name === 'AbortError' || err.message?.includes('AbortError') || err.message?.includes('abort')
```

这是三套中止写法唯一能凑成一致的地方——换个人写错文案，中止就会被当成真实失败报给用户（`status: 'error'` + 控制台报错）。

**修复**：改为 `isAbortError(err)`，按 `instanceof` / `name` 判定；字符串分支仅作过渡兼容。

### 3. `matchBgRemoveEngine` 解码阶段不响应中止

中止只在 worker 阶段挂钩，而解码（FileReader + `new Image` + `drawImage` + `getImageData`）在大图上是耗时的。用户点「终止」后仍要等到 worker 阶段才生效。

**修复**：补齐四处空窗——FileReader 解码、`new Image` 解码、`getImageData` 之后到 worker 挂上之前、`canvas.toBlob` 编码阶段。

### 4. `exifEngine` 完全不支持中止

`useToolRun.act()` 统一实现了 abort 分支，但 `exifEngine` 根本不读 `options.signal`。界面上显示「正在处理… (点击终止)」，点了没反应。

**修复**：接上 `onAbort` + `AbortError`，并在 `onload` / `onerror` 里解绑。

### 5. crop / filter 缺解码前的 `aborted` 检查

`onAbort` 只在 signal **后续** abort 时触发。若 signal 一开始就已中止，事件永远不发，裸监听器干等——**整条解码 + 渲染 + toBlob 白跑一遍才 reject**。

**修复**：三处引擎统一加 `if (options.signal?.aborted) throw new AbortError()`。

### 6. `faviconEngine` 的 `resolve(blob!)` 与非空断言

```ts
// 修复前
const ctx = canvas.getContext('2d')!        // 返回 null 时崩在下一行
canvas.toBlob((blob) => resolve(blob!), ...)  // 编码失败时 ZIP 里躺 0 字节条目
```

**修复**：显式判空 reject。用户不会再下载到一个含空图标、且界面毫无提示的 ZIP。

---

## 三、`lib/engines/abort.ts`

中止语义的单一真源：

```ts
AbortError // 具名错误类型，name 固定 AbortError
isAbortError() // 按 instanceof / name 判定
onAbort(signal, fn) // 挂一次性回调，返回幂等解绑
throwIfAborted(signal) // 长循环里的统一检查点
```

`onAbort` 相对裸 `addEventListener` 的三处补强：

1. signal 已 aborted 时**立即回调**。已中止的 signal 不会再触发事件，裸监听器会永远等下去
2. 自动 `{ once: true }`，解绑幂等
3. 强制抛 `AbortError`，不再各写文案

修复后 8 个引擎的中止行为统一，`useImageProcessor` 不再需要字符串匹配。

---

## 四、测试补齐

| 引擎                                                                  | 修复前     | 修复后 |
| --------------------------------------------------------------------- | ---------- | ------ |
| crop / resize / split / combine / compress / bgRemove / matchBgRemove | 有测试     | —      |
| filter / exif / favicon                                               | **零测试** | +76 条 |

新增的 76 条覆盖：CSS filter 串联、可选步骤（sharpen / vignette / noise）的开关行为与副作用、`'image/jpeg-li'` MIME 归一化、maskable 80% 安全区、ICO 容器结构、manifest 生成、README 引用、各条中止路径。

**每条修复都验证过能抓回归**：

| 破坏                                      | 结果        |
| ----------------------------------------- | ----------- |
| 去掉 `onAbort` 的 `removeEventListener`   | 3 条红      |
| 去掉「signal 已中止立即回调」             | 3 条红      |
| `name` 判定改false                        | 2 条红      |
| 撤掉 crop 的解码前检查                    | 恰好 1 条红 |
| 撤掉 exif 的解码前检查                    | 恰好 1 条红 |
| `toBlob` 的 null 检查改回 `resolve(null)` | 恰好 1 条红 |

两条既有测试断言的是文案 `toThrow('AbortError')`，改为断言身份 `e.name === 'AbortError'`——文案可能变，name 不会。这两条断言本身也是脆弱的。

---

## 五、浏览器验收

工具：chrome-devtools MCP（配在 `~/.config/opencode`，不进仓库）。

### 验收结果

**11 个视图全部通过**：

| 视图      | 关键轨迹                                                                      |
| --------- | ----------------------------------------------------------------------------- |
| Compress  | 3 图并发 `(0/3)` → `导出选中(3)`                                              |
| Resize    | `正在重采样渲染...(点击中止)` → `批量导出成果 (1)`                            |
| Crop      | `正在处理...(点击中止)` → `导出选中裁剪 (1)`                                  |
| Crop 中止 | 自动点击 → **12ms 回到就绪态**，未产出结果                                    |
| Split     | 进度 11%→22%→67%→100% → `导出全部切片`；改列数 → `更新切分方案`               |
| Filters   | `滤镜渲染中...(点击中止)` → `导出调色成果 (1)`；改饱和度 → `更新当前滤镜 (1)` |
| Exif 中止 | 自动点击 → **6ms 掐断**（修复前会继续跑完并产出结果）                         |
| Exif 正常 | → `导出脱敏后的图片 (1)`，EXIF 标签已清除                                     |
| Combine   | `正在合成长图中...(点击中止)` → `导出拼接长图`                                |
| Favicon   | ZIP 148 718 B + `favicon_pack_*.zip`                                          |
| MoldCut   | 篮子 0→1→2，`test-800x600_模具切.zip` 2138 B                                  |
| BgRemove  | 切「色值」后 match 专属参数出现（`resolveEngine` 路径）                       |

**12 个引擎全部有测试 + 真实浏览器验证**：

- **AI 推理**：ISNet 量化版（40 MB）——像素验证四角 `[0,0,0,0]` 全透明、中心 `[220,30,30,255]` 颜色精确；模型缓存（11 s → 637 ms）、遮罩缓存（改羽化后重跑，模型请求 0 个）、共享 worker 中止（105 ms 生效）
- **SAM2**（12 MB hiera-tiny）——掩码中心 `[255,255,255,186]`（软掩码特征）、四角透明；`handleInteractiveApply` 成功并回主流程
- **wasm 编解码**——AVIF 2140 B / JXL 4476 B / JPEG 5306 B，MIME 归一化正确

### 一次未复现的异常

某次压缩完成后弹alert「无法读取文件 [test-800x600.png] 的图片尺寸，请确认文件未损坏」。装 alert 拦截器重跑三次均未复现，也未找到对应的代码路径（该文案只在 `importRejections.ts` 用于导入失败，而 alert 出现在压缩完成之后）。

倾向于是测试环境残留（那次跑完 SAM2 后未刷新即换路由），但**没有证据排除真实竞态**。后续若遇到，值得留意触发时机。

---

## 六、4 项主动放弃的重构

以下四项曾列入待办，逐一核实后决定**不做**。记录理由以免重复评估。

### 抽解码骨架（4 处 × 4 行 ≈ 16 行样板）

实测真正重复的只有 `new Image()` / `createObjectURL` / `onload`+`revoke` / `onerror`+`revoke` / `img.src = url` 这 4 行样板，其余 450 行是各自的像素逻辑。

而 `onload` 有同步（filter/exif）和异步（crop/split）两种写法，crop/filter 还多一层 abort 清理——为 16 行引入 4 个方差分支，净复杂度上升。

### worker 协议统一（三份 worker）

三者**不是同一个抽象**：

| worker            | 消费者                   | 语义                                     |
| ----------------- | ------------------------ | ---------------------------------------- |
| `bgRemove.worker` | `bgRemoveEngine`         | 请求-应答（AI 推理 + 遮罩缓存）          |
| `matchWorker`     | `matchBgRemoveEngine`    | 请求-应答（像素计算）                    |
| `sam2.worker`     | `InteractiveEditorModal` | **长驻会话**（load/encode/decode/reset） |

两个请求-应答 worker 看着像重复，差异却源于真实约束：`bgRemove` 是**共享单例**，中止不能 `terminate()`（会杀掉其他请求），只能 `disposeBgRemoveWorker`；`match` 是私有 worker，直接 terminate。抽成统一抽象会迫使 bgRemove 放弃共享池（性能倒退）。

### 三视图迁移 `useToolRun`（Combine / Favicon / MoldCut）

这三个视图的形态与已迁移的 7 个本就不同：MoldCut 是「篮子累加」而非「结果 Map」，Favicon 是「一次生成 ZIP」，Combine 是「合成单图」。强行套用 `outputs: Blob[]` + 单 CTA 模型会扭曲它们。

实测它们**已各自实现了等价的 `clickToAbort` 模式**。

### `imageStore` 拆分

三条待核实理由，逐条实测后**均不成立**：

| 记录的理由                        | 实测结果                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 合法类型白名单 3 份               | **只有 1 份**。`useFileHelpers` 的 `mimeMap` 是 MIME→扩展名映射（决定下载文件名），与准入白名单语义不同 |
| 并发上限 3 份                     | 数值不同（3/4/5）但**语义也不同**：引擎处理 / 全尺寸解码 / EXIF 读取分批，各为各自负载调出              |
| 响应式 store 持 `abortController` | 实测 Vue **不代理类实例**（`protoName: 'AbortController'`、`sameRef: true`）。无 Proxy 开销             |

---

## 七、当前状态

```
512 tests（29 → 512，+483）
npm run validate 全绿（0 error / 3 个既存warning）
12 个主引擎全部有测试
11 个视图 + 3 个 worker 全部真实浏览器验证
```

**唯一的环境限制项**：BgRemove 的 ISNet 完整精度版（176 MB）未验证（只验了 40 MB 量化版）；SAM2 的完整系列未验证（只验了 hiera-tiny）。
