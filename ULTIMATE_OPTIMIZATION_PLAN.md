# 极致性能优化终极执行计划 (Ultimate Performance Optimization Plan)

基于 35 位 Agent 的深度检索分析，以及最后 10 位验证 Agent 对目标文件 `part3_game_single (6) (9)(9)(2)(6) (36) (14).html` 的专项代码级交叉验证，我们已得出最权威、最安全的终极重构计划。

前期 4 项微观性能优化（GC 闭包剥离、DOM 抖动消除、状态去重、异步解码）已合并完毕。以下是接下来需要执行的 7 个核心阶段：

## Phase 1: 修复致命级内存泄漏与卡死 (Critical Fixes) - 【首要执行】
1. **音频节点泄漏 (Audio Node Leak) ✅ [验证通过]**
   - **问题**：`__caveReverbInstalled` 补丁中重写的 `noise` 和 `beep` 方法未清理 `OscillatorNode` 和 `BufferSource`，导致下雨天节点堆积，耗尽音频线程。
   - **方案**：利用原生的 `onended` 事件，在音效播放结束时补充 `_node.disconnect()` 彻底释放。
2. **存档系统主线程阻塞 (Save System Freeze) ✅ [验证通过]**
   - **问题**：序列化和 RLE 压缩在主线程同步执行，导致每 30 秒游戏卡死一次。
   - **方案**：将 `SaveSystem.diff`（结构化克隆兼容）传递给 Web Worker，在后台执行 JSON.stringify 和 RLE 压缩。
3. **字符串拼接 O(N²) 爆炸 ✅ [验证通过]**
   - **问题**：`_rleEncodeU8` 方法在循环内使用 `out += ...` 进行大体积地图数据拼接。
   - **方案**：替换为 `out = []` 配合 `out.push(...)` 和 `out.join("")`，消除 V8 内存分配雪崩。

## Phase 2: Canvas 渲染管线深度压榨 (Render Pipeline)
1. **合并区块级的 clearRect ✅ [验证通过]**
   - **问题**：`_updateChunkTile` 批量修补时，对每个 1x1 瓦片单独执行 `clearRect`，触发大量 Skia 绘图指令。
   - **方案**：计算更新区域的包围盒，合并为一整块大面积擦除。
2. **解除 GPU 封印 ✅ [验证通过]**
   - **问题**：`MinimapRenderer` 等离屏画布初始化误用了 `willReadFrequently: !0`。
   - **方案**：移除只写不读画布的该标志，恢复 GPU 硬件加速。
3. **状态机手动回滚 ⚠️ [部分拦截：高风险]**
   - **修正方案**：仅对单纯修改 `globalAlpha` 和 `fillStyle` 的场景替换为手动回滚；对使用了 `translate/rotate/clip` 的复杂场景保留 `save/restore`。
4. **优化缓存重用 ⚠️ [拦截：高风险]**
   - **修正方案**：放弃局部包围盒擦除（会导致残影），转而完善 `_tryPartialCacheReuse` 机制，最大化利用 `drawImage` 的整体平移。

## Phase 3: V8 引擎对象与字典优化 (V8 De-optimization)
1. **消除字典模式降级 ✅ [验证通过]**
   - **问题**：实体网格系统 `this.cells = Object.create(null)` 在高频读写下退化为慢速字典模式。
   - **方案**：重构为 `new Map()`，核心碰撞逻辑替换为 `.get(key)`，`getStats` 优化为 `O(1)` 的 `.size`。
2. **阻断隐藏类 (Shape) 降级 ✅ [验证通过]**
   - **问题**：`Player` 和 `DroppedItem` 动态添加属性，破坏了单态性。
   - **方案**：补全 constructor，提前声明所有属性（赋初值为 0 或 null）。
3. **ObjectPool 扩容缺陷 ✅ [验证通过]**
   - **问题**：突发粒子特效会导致对象池枯竭，引发瞬时 GC 压力。
   - **方案**：引入动态 maxSize 扩容或衰减机制。

## Phase 4: 零分配网络与同步 (Zero-Allocation Network)
1. **全局共享 Buffer ✅ [验证通过]**
   - **问题**：`_packWire` 每次通信都在执行 `new ArrayBuffer(len)`，每秒产生数百次分配。
   - **方案**：预分配 1MB 的 `SHARED_BUFFER`，使用 `DataView` 写入并返回 `subarray`，实现零分配网络发包。
2. **视线裁剪 (LOS Culling) ✅ [验证通过]**
   - **方案**：引入 Bresenham 射线检测，若两玩家间被实体遮挡，强制将网络更新频率降至 ~3Hz 以节省带宽。

## Phase 5: 高级缓存与 UI 优化 (Caching & DOM)
1. **修复 Layout Thrashing (布局抖动) ✅ [验证通过]**
   - **方案**：将 `_updateCrosshair` 和 `_updateJoystick` 中的 `getBoundingClientRect` 读操作与 style 写操作分离，并用 rAF 节流。
2. **离屏文本缓存与超采样 ⚠️ [条件验证]**
   - **方案**：缓存伤害数字和名字，但必须将 `dpr` 和 `scale` 作为缓存 Key 解决动态缩放模糊问题。

## Phase 6: 算法与循环重构 (Algorithms & Hot Paths)
1. **位运算替代除法 ✅ [验证通过]**
   - **方案**：全局检索 `Math.floor(x / 16)` 或类似坐标转换，统一替换为无分支的单周期指令 `x >> 4`。
2. **修复后处理流水线致命漏洞 ✅ [验证通过]**
   - **方案**：在 `Renderer._runPostFxPipeline` 中，移除无意义的 `.some()` 闭包和 `.sort()`，替换为经典 `for` 循环与状态标志。
3. **搁置环形缓冲区重构 ❌ [拦截：极高风险]**
   - **结论**：外部依赖物理数组顺序，且数组长度极小（<100），`shift()` 开销微乎其微，直接取消该优化。

## Phase 7: 物理宽阶段缓存 (Broadphase Cache)
1. **Chunk-level 碰撞缓存 ✅ [验证通过]**
   - **方案**：建立 `_solidChunkCache`，缓存 16x16 区域内的固体方块数量，计数为 0 时实现 O(1) 射线步进跳过。

---
**结论**：上述计划已经过 45 位 Agent（35 检索 + 10 验证）的严密交叉验证，剔除了破坏渲染和物理的负优化，锁定了真实的性能黑洞。随时可以进入代码执行阶段。