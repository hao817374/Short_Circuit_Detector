# 短路测试仪 V1.0.1 发行说明

基于 Karpathy 准则（Surgical Changes + Simplicity First），此版本重点解决影响商用稳定性的安全与性能隐患。

## 🚀 核心优化与修复

### 1. 离线环境支持（严重修复）
- **问题**：原 V1.0.0 依赖在线 Tailwind CDN 与 Google Fonts，在断网的工厂环境中会导致所有样式丢失、UI 彻底崩溃。
- **解决**：移除了所有外部 CDN 依赖，构建了本地化的 PostCSS/Tailwind 编译流程，并将字体库（Inter, JetBrains Mono）完全内嵌。软件现已 100% 支持完全离线部署。

### 2. 核心 DSP 算法零分配去重（性能提升）
- **问题**：`DebugChart` 视图之前拷贝了一份 `getWindowAvg` 的旧版本实现，每次更新视图均产生高 GC 压力。
- **解决**：提取了统一的高性能 DSP 工具库（`utils/dsp.ts`）。主线程 `commitFrame` 和 `DebugChart` 目前复用同一个 `sharedSortBuffer` 的零分配过滤器，内存稳定性大幅提升。

### 3. 主进程安全限制（安全加固）
- **问题**：旧版本 Electron 开启了 `nodeIntegration` 且未开启 `contextIsolation`，这在商业审计中属于高危安全漏洞。
- **解决**：强制开启 `contextIsolation: true` 和禁用 `nodeIntegration`。应用逻辑与底层文件系统完全沙盒隔离。

### 4. 消除栈溢出隐患（健壮性优化）
- **问题**：在 `App.tsx`（校准范围计算）和 `MultiFrameChart` 中，旧逻辑使用了 `Math.max(...array)` 形式。在点数增加时极易引发 V8 引擎调用栈溢出崩溃。
- **解决**：手术刀式替换为原生的 `for` 循环迭代计算最大/最小值，不仅消除了崩溃隐患，并且去除了中间数组的高频内存分配（`map` 调用）。
