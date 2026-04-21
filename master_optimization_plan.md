# 终极性能优化执行计划 (The Master Optimization Plan) - V8 & WebGL 深度调优版

基于前 5 轮的扫描、第 6 轮的专项验证，以及**结合了其他 AI 团队提供的补充方案**，我们对所有被提出的优化点进行了严苛的代码级验证与可行性评估。

在您已经完美落实了 4 项微观性能极限压榨（GC 闭包剥离、Layout Thrashing 防抖、Canvas 状态去重、图像异步解码）的基础上，以下是融合了所有安全、高效、且经过验证的**终极综合版重构计划**。

---

## 🚫 被验证否决的“伪优化”（避免踩坑）
在整合其他 AI 的方案时，我们通过验证拦截了以下高风险或过时的优化建议：
1. **取消主循环 try-catch 抽离**：其他 AI 建议将 `AnimFrame` 和 `Game.loop` 中的 `try-catch` 抽离为 `_safeExecute`。**验证结论：否决**。现代 V8 (TurboFan) 已经完全支持 `try-catch` 的内联优化。如果在高频循环中强行包裹一层函数，反而会带来严重的闭包创建（GC 压力）或函数调用栈开销，得不偿失。
2. **保留水面 clip() 裁剪**：其他 AI 建议用 `source-atop` 或修改控制点来移除水波的 `ctx.clip()`。**验证结论：降级保留**。修改路径容易在振幅较大时出现“削顶”，而合成模式会干扰底部海水的渲染。由于该渲染位于局部瓦片层，性能损耗处于可控范围内，为保证完美的视觉呈现，建议维持现状。
3. **保留全屏 clearRect**：原计划用局部包围盒擦除替代全屏 `clearRect`。**验证结论：否决**。摄像机移动时，局部擦除会导致透明/半透明方块产生严重的残影与像素叠加。

---

## 🚀 最终执行阶段 (The Master Plan)

### Phase 1: 解救 CPU —— 斩断无效遍历与通信拥堵
1. **消灭 O(N) 压力板暴力扫描 (New!)**：
   * **症状**：为了检测玩家是否踩在机关上，游戏每帧都在 `update` 里全局遍历所有实体。
   * **方案**：废除全局遍历。接入引擎已有的 `SpatialHashGrid`，实现 `O(1)` 的局部坐标精准查询。
2. **修复失效的 Perlin 噪声缓存 (New!)**：
   * **症状**：`noise2D` 里的缓存逻辑使用 `x === (0|x)` 匹配，但传入的总是带频率的浮点数，导致 100% Cache Miss，且写入逻辑内部变量已被篡改，缓存彻底损坏。
   * **方案**：直接删除这部分无效的 Map 缓存逻辑。现代引擎的数学运算速度远超这种存在分支和哈希查找的残破缓存，删除后反而能提升地形生成的 JIT 执行速度。
3. **Worker 消息批处理 (Batching) (New!)**：
   * **症状**：主线程每次放一个方块，就向 Worker 发送一个 `tileWrite` 对象，爆炸或大面积更新时引发极高的结构化克隆开销。
   * **方案**：将一帧内的方块变动收集进一个 `Int32Array`，在帧末通过 Transferable Objects 零拷贝一次性发给 Worker。
4. **音频节点泄漏修复**：
   * **症状**：补丁里的山洞混响重写了 `beep` 和 `noise`，但忘记调用 `disconnect()`，导致下雨天内存泄漏。
   * **方案**：利用原生的 `onended` 事件，在音效播放结束时安全销毁 `GainNode`。

### Phase 2: 解放 GPU —— 消除 Canvas 渲染黑洞
1. **彻底移除高斯模糊 ctx.shadowBlur (New!)**：
   * **症状**：粒子系统在一个颜色批次中混杂了发光和普通粒子，导致每颗发光粒子都会触发两次极其昂贵的 `shadowBlur` 开启/关闭。
   * **方案**：【粒子系统】预渲染一个径向渐变的 Sprite，将发光粒子统一设置为 `globalCompositeOperation = "lighter"`（加法混合）并绘制 Sprite，完美替代 `shadowBlur` 且带来 HDR 光效。【名字文本】保留当前的 `shadowBlur`（由于同屏文本少，保底可读性更重要）。
2. **解除 GPU 封印**：
   * **症状**：`MinimapRenderer` 等离屏画布初始化误用了 `willReadFrequently: !0` 标志。
   * **方案**：安全移除该标志，因为小地图只写不读（仅使用 `putImageData`），移除将恢复其 GPU 硬件加速能力。

### Phase 3: 终结 GC 抖动 —— 零分配架构深化
1. **全局共享网络 Buffer**：
   * **症状**：多人联机时，每秒几百次的 `_packWire` 都在 `new ArrayBuffer`。
   * **方案**：预分配 1MB 的 `SHARED_BUFFER`。使用 `DataView` 直接写入并返回 `subarray` 发送。由于 WebRTC 的 `send()` 底层是同步内存提取，发送后立刻覆盖 Buffer 是绝对安全的。
2. **阻断 V8 隐藏类 (Shape) 降级**：
   * **症状**：`Player` 和 `DroppedItem` 在构造函数外动态添加了 `_sleep`, `input`, `_hurtKind` 等属性，导致 V8 内联缓存失效。
   * **方案**：补全 `constructor`，提前声明所有隐藏属性（赋初值为 0 或 null），维持对象的单态性 (Monomorphism)。
3. **消除字典模式降级**：
   * **症状**：实体网格系统 `this.cells` 使用了 `Object.create(null)`，导致长线游玩时内存膨胀和 `Object.keys().length` 的 O(N) 性能损耗。
   * **方案**：将其重构为原生的 `new Map()`，核心碰撞逻辑的 `this.cells[key]` 替换为 `.get(key)`。

### Phase 4: 算法与逻辑压榨
1. **修复 PostFx 致命漏洞**：
   * **方案**：在 `Renderer._runPostFxPipeline` 中，将每帧无意义的 `.some()` 闭包和 `.sort()` 替换为经典 `for` 循环与状态标志拦截（`_pendingStagesMerged`）。
2. **位运算替代除法**：
   * **方案**：全局检索方块坐标转换，将 `Math.floor(x / 16)` 统一替换为无分支的单周期指令 `x >> 4`。（游戏最大坐标远低于 32 位整数溢出阈值，绝对安全）。
3. **存档系统主线程解脱**：
   * **方案**：重构自动存档逻辑，将 `SaveSystem.diff` 传递给 Web Worker。在 Worker 内部调用 `_encodeDiff` 将 Map 转换为数组，再执行兆字节级的序列化与 RLE 压缩。
4. **字符串拼接 O(N²) 爆炸修复**：
   * **方案**：重写 `_rleEncodeU8`，将 `out += ...` 替换为 `out.push(...)` 和 `out.join("")`。