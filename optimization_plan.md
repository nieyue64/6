# 极致性能优化计划 (Ultimate Performance Optimization Plan)

基于前 5 轮共 35 个专门 Agent 的深度检索与分析，我们定位到了当前代码库中隐藏在“高性能”表象下的 20 余处致命瓶颈。该优化计划将这些瓶颈分为 7 个核心阶段进行逐一击破：

## Phase 1: 修复致命级内存泄漏与卡死 (Critical Fixes)
1. **音频节点泄漏 (Audio Node Leak)**：修复 `__caveReverbInstalled` 补丁中重写的 `noise` 和 `beep` 方法。在音效播放结束时，必须断开并销毁创建的 `GainNode` 和 `OscillatorNode`，防止在下雨天气下 1 分钟内堆积上百个废弃节点耗尽音频线程 CPU。
2. **存档系统主线程阻塞 (Save System Freeze)**：重构自动存档逻辑，将巨量数据的 `JSON.stringify`、`Array.prototype.sort` 和 RLE 压缩移至 Web Worker，并引入 IndexedDB 的异步写入，彻底解决游戏每 30 秒卡死一次的问题。
3. **字符串拼接 O(N²) 爆炸**：重写 `_rleEncodeU8`，将 `out += ...` 替换为 `out.push(...)` 和 `out.join("")`，消除处理兆字节级地图数据时的内存分配雪崩。

## Phase 2: Canvas 渲染管线深度压榨 (Render Pipeline)
1. **彻底消除全屏重绘 (Dirty Rect Culling)**：废弃 `Renderer` 中粗暴的 `_worldDirty = !0` 和全屏 `clearRect`。引入类似于 `Minimap` 的包围盒合并算法（Bounding Box），并在绘制前使用 `ctx.clip()` 限制渲染区域。
2. **合并区块级的 `clearRect`**：在 `_updateChunkTile` 的批量修补中，将 1x1 的微小擦除合并为一整块大面积擦除，大幅降低 Skia/Blink 底层绘图指令开销。
3. **解除 GPU 封印**：移除 `MinimapRenderer` 和 `MiningIcon` 画布初始化中误用的 `willReadFrequently: !0` 标志，恢复其硬件加速能力。
4. **状态机手动回滚**：将 `renderSky`, `renderParallax`, `applyPostFX` 等场景中几十次无谓的 `ctx.save/restore` 替换为手动状态重置（如 `ctx.globalAlpha = 1`）。

## Phase 3: V8 引擎对象与字典优化 (V8 De-optimization)
1. **阻断隐藏类 (Shape) 降级**：补全 `Player` 和 `DroppedItem` 的 `constructor`，提前声明 `_sleep`, `input`, `_hurtKind` 等所有属性，维持对象的单态性 (Monomorphism)。
2. **消除字典模式降级与墓碑残留**：将实体网格系统 `this.cells` 重构为 `new Map()`，将区块构建追踪 `this._chunkBuildSet` 重构为 `new Set()`，彻底解决长线游玩时的内存膨胀。
3. **ObjectPool 扩容缺陷**：为对象池引入动态 `maxSize` 扩容或衰减机制，修复突发粒子特效导致的池枯竭与瞬时 GC 压力。

## Phase 4: 零分配网络与同步 (Zero-Allocation Network)
1. **全局共享 Buffer**：重构 `_packWire` 和 `_unpackWire`，预分配 1MB 的 `SHARED_BUFFER`。使用 `DataView` 直接写入并返回 `subarray` 引用，消除每秒数百次的 `new ArrayBuffer` 和 `new Uint8Array` 分配。
2. **视线裁剪 (LOS Culling)**：在目前的距离（AOI）降频基础上，引入 Bresenham 射线检测。如果两个玩家间被实体方块遮挡，将网络更新频率强制降至最低（~3Hz），极大地节省带宽。

## Phase 5: 高级缓存与 UI 优化 (Caching & DOM)
1. **离屏文本缓存 (Offscreen Text)**：针对高频的掉落物堆叠数字和远端玩家昵称（带有极耗性能的 `shadowBlur`），生成静态的 `OffscreenCanvas` 纹理并使用 `drawImage` 替代每帧的 `fillText`。
2. **修复 Layout Thrashing (布局抖动)**：将准星更新（`_updateCrosshair`）和摇杆（`_updateJoystick`）中的 `getBoundingClientRect` 读操作和 `style` 写操作分离，并用 `requestAnimationFrame` 包裹所有的 `touchmove/pointermove` UI 更新。

## Phase 6: 算法与循环重构 (Algorithms & Hot Paths)
1. **修复后处理流水线致命漏洞**：在 `Renderer._runPostFxPipeline` 中，将 `.some()` 闭包和每帧无用的 `.sort()` 替换为经典 `for` 循环与状态标志拦截。
2. **替换 O(N) 的 `shift()`**：将主循环中的 `fpsSamples` 和 `trajectoryPoints` 重构为固定长度的环形缓冲区（Ring Buffer）。将 `urgentQueue` 任务队列的 `splice` 替换为双指针延迟截断。
3. **位运算替代除法**：全局检索方块坐标转换，将 `Math.floor(x / 16)` 统一替换为无分支、无浮点运算的单周期指令 `x >> 4`。
4. **消除跨语言边界调用**：将主循环物理预测中的 `Math.max` 和 `Math.min` 替换为内联的三元表达式 `a > b ? a : b`。

## Phase 7: 物理宽阶段缓存 (Broadphase Cache)
1. **引入 Chunk-level 碰撞缓存**：建立 `_solidChunkCache`，缓存 16x16 区域内的固体方块数量。在实体移动（尤其是高速投射物）时，遇到计数为 0 的 Chunk 直接 O(1) 跳过，免去逐个 Tile 的射线步进检测。