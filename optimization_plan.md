# 极致性能优化计划 (Ultimate Performance Optimization Plan) - 已验证版

基于前 5 轮共 35 个专门 Agent 的深度检索与分析，以及第 6 轮的 10 个 Agent 专项验证，我们定位到了当前代码库中隐藏在“高性能”表象下的核心性能瓶颈，并排除了部分高风险的盲目优化。该优化计划将分为 7 个核心阶段进行逐一击破：

## Phase 1: 修复致命级内存泄漏与卡死 (Critical Fixes)
1. **音频节点泄漏 (Audio Node Leak)**：【验证通过：极度安全】修复 `__caveReverbInstalled` 补丁中重写的 `noise` 和 `beep` 方法。利用原生的 `onended` 事件，在音效播放结束时断开并销毁 `GainNode` 和 `OscillatorNode/BufferSource`，防止下雨天气下废弃节点堆积耗尽音频线程 CPU。
2. **存档系统主线程阻塞 (Save System Freeze)**：【验证通过：需注意 Map 序列化】重构自动存档逻辑，将 `SaveSystem.diff`（结构化克隆兼容）传递给 Web Worker。在 Worker 内部先调用 `_encodeDiff` 将 Map 转换为数组，再执行兆字节级的 `JSON.stringify`、`Array.prototype.sort` 和 RLE 压缩，彻底解决游戏每 30 秒卡死一次的问题。
3. **字符串拼接 O(N²) 爆炸**：【验证通过】重写 `_rleEncodeU8`，将 `out += ...` 替换为 `out.push(...)` 和 `out.join("")`，消除处理大体积地图数据时的内存分配雪崩。

## Phase 2: Canvas 渲染管线深度压榨 (Render Pipeline)
1. **优化缓存重用，而非盲目消除 clearRect**：【验证拦截：高风险】原计划用局部包围盒擦除替代全屏 `clearRect` 会导致摄像机移动时半透明方块产生严重残影。优化方向应转为：完善现有的 `_tryPartialCacheReuse` 机制，最大化利用 `drawImage` 的整体平移，仅对屏幕边缘的新暴露区域进行渲染。
2. **合并区块级的 `clearRect`**：在 `_updateChunkTile` 的批量修补中，将 1x1 的微小擦除合并为一整块大面积擦除，大幅降低 Skia/Blink 底层绘图指令开销。
3. **解除 GPU 封印**：【验证通过：极度安全】移除 `MinimapRenderer` 等离屏画布初始化中误用的 `willReadFrequently: !0` 标志。因为小地图只写不读（仅使用 `putImageData`），移除该标志将安全地恢复其 GPU 硬件加速能力。
4. **状态机手动回滚（精准替换）**：【验证拦截：高风险】仅将单纯修改 `globalAlpha` 和 `fillStyle` 的场景（如 `renderSky` 和简单叠加层）替换为手动状态重置。对于 `applyPostFX`（使用了 `setTransform`）和 `Player.render`/水面渲染（使用了 `translate/rotate/clip`）的复杂场景，必须保留 `save/restore`，否则会彻底摧毁摄像机视角和高分屏比例。

## Phase 3: V8 引擎对象与字典优化 (V8 De-optimization)
1. **阻断隐藏类 (Shape) 降级**：补全 `Player` 和 `DroppedItem` 的 `constructor`，提前声明 `_sleep`, `input`, `_hurtKind` 等所有属性（赋初值为 0 或 null），维持对象的单态性 (Monomorphism)。
2. **消除字典模式降级**：【验证通过：极度安全】将实体网格系统 `this.cells` 重构为 `new Map()`。核心碰撞逻辑的 `this.cells[key]` 替换为 `.get(key)`，同时将 `getStats()` 中的 O(N) `Object.keys().length` 优化为 O(1) 的 `.size`，彻底解决长线游玩时的内存膨胀。
3. **ObjectPool 扩容缺陷**：为对象池引入动态 `maxSize` 扩容或衰减机制，修复突发粒子特效导致的池枯竭与瞬时 GC 压力。

## Phase 4: 零分配网络与同步 (Zero-Allocation Network)
1. **全局共享 Buffer**：【验证通过：极度安全】重构 `_packWire` 和 `_unpackWire`，预分配 1MB 的 `SHARED_BUFFER`。使用 `DataView` 直接写入并返回 `subarray` 引用。由于 WebRTC 的 `send()` 底层是同步内存提取，发送后立刻覆盖 Buffer 是绝对安全的，这能消除每秒数百次的 `new ArrayBuffer` 分配。
2. **视线裁剪 (LOS Culling)**：在目前的距离（AOI）降频基础上，引入 Bresenham 射线检测。如果两个玩家间被实体方块遮挡，将网络更新频率强制降至最低（~3Hz），极大地节省带宽。

## Phase 5: 高级缓存与 UI 优化 (Caching & DOM)
1. **离屏文本缓存 (Offscreen Text) 与超采样**：【验证拦截：需处理缩放模糊】针对高频的掉落物数字和远端玩家昵称，生成静态的 `OffscreenCanvas` 纹理替代每帧 `fillText`。为了解决动态缩放变模糊的问题，必须将当前的 `dpr` 和摄像机 `scale` 作为缓存 Key，并在缩放改变时重新生成高分辨率的超采样纹理。
2. **修复 Layout Thrashing (布局抖动)**：将准星更新（`_updateCrosshair`）和摇杆（`_updateJoystick`）中的 `getBoundingClientRect` 读操作和 `style` 写操作分离，并用 `requestAnimationFrame` 包裹所有的 `touchmove/pointermove` UI 更新。

## Phase 6: 算法与循环重构 (Algorithms & Hot Paths)
1. **修复后处理流水线致命漏洞**：在 `Renderer._runPostFxPipeline` 中，将每帧无意义的 `.some()` 闭包和 `.sort()` 替换为经典 `for` 循环与状态标志拦截（`_pendingStagesMerged`）。
2. **搁置环形缓冲区重构**：【验证拦截：高风险】原计划将 `fpsSamples` 和 `trajectoryPoints` 改为环形缓冲区以消除 `shift()`。验证发现外部存在大量依赖物理数组顺序的逻辑（如 `.slice(-7)` 和 `length - 1`）。由于数组极小（长度<100），`shift()` 开销微乎其微，重构带来的逻辑风险远大于收益，故**取消该项优化**。
3. **位运算替代除法**：【验证通过：极度安全】全局检索方块坐标转换，将 `Math.floor(x / 16)` 统一替换为无分支的单周期指令 `x >> 4`。游戏最大坐标（160,000）远低于 32 位整数溢出阈值（21.4亿），不存在符号反转风险。

## Phase 7: 物理宽阶段缓存 (Broadphase Cache)
1. **引入 Chunk-level 碰撞缓存**：建立 `_solidChunkCache`，缓存 16x16 区域内的固体方块数量。在实体移动时，遇到计数为 0 的 Chunk 直接 O(1) 跳过，免去逐个 Tile 的射线步进检测。