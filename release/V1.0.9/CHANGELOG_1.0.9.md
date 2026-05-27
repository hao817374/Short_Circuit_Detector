# Short Circuit Detector v1.0.9 版本说明

## 交互优化

- **DEBUG 视图上半部布局重构**:
    - 三列重新分配：第1列仅返回按钮，第2列三圆盘纵向排列+暂停按钮居中，第3列三行校准网格（零点校准/右上采集/右下采集）。
    - 零校准按钮支持中/英文切换（此前硬编码英文 "ZERO CALIB"）。
    - SW 采集箭头修正：ArrowDownLeft→ArrowDownRight，NW 采集箭头：ArrowUpLeft→ArrowUpRight。
    - 移除 Q0/Q1 offset 输入框，校准结果标签改为 "Q0:/Q1:" 格式，数值宽度统一。
    - 三圆盘尺寸 128px→160px，上半部最小高度提升至 280px。

- **空间校准界面功能与视觉完善**:
    - 零校准按钮加入图标（Zap→CheckCircle2），布局改为左对齐 px-6 风格，与方向校准按钮完全统一。
    - 零校准结果框不在点击时立即显示 NULL，等 1s 采样完成后再根据结果展示数值或 NULL。
    - "确认并应用"按钮逻辑修复：改用 `zeroCalibResult`（持久有效）代替 `zeroCalibStatus`（3s 后自动消失）判断可点击条件。
    - 零校准状态文字中文化（"校准成功"/"校准失败"）。
    - 方向校准加入稳定性校验：采样数 ≥5 + Q0/Q1 极差检查，与零点校准判断逻辑完全一致；失败时不写入校准值。
    - 方向校准状态文字统一为"校准成功"/"部分成功"/"校准失败"。
    - 稳定性阈值改为自适应：`max(1000, |avg| × 15%)`，零点校准信号≈0 时行为不变，方向校准大信号时按比例放宽。
    - 方向校准闭包过时修复：`samplingStep` 移入 `stateRef`，`commitFrame` 从 ref 读取（与 `isZeroSampling` 模式一致），解决按钮点击无反应问题。

- **DEBUG 视图上半部布局优化**:
    - 返回按钮置顶（`self-start`）。
    - 暂停按钮左侧显示 Q0 实时数值、右侧显示 Q1 实时数值。
    - 零点校准数值框格式与空间校准界面统一（Q0:/Q1:/BIAS: 格式 + 失败显示 NULL）。

- **串口连接 VID/PID 自动学习过滤**:
    - 首次连接成功后自动调用 `port.getInfo()` 获取硬件 USB VID/PID，存入 localStorage。
    - 后续启动时 `getPorts()` 返回的端口列表中只匹配 VID/PID 一致的设备，不干扰其他串口。
    - 换 USB 口：VID/PID 不变，静默连接；芯片更换：无匹配，回退弹窗重选后自动更新存储。
    - `connectToPort`（欢迎页/顶栏连接按钮）先尝试匹配端口，无匹配时才弹出原生端口选择对话框。

- **代码清理**:
    - 移除校准矩阵版本迁移逻辑（`CALIB_MATRIX_VERSION` / `calibMatrixVersion`），矩阵公式为底层算法不需版本对比。
    - 清理冗余注释和 dead code。

- **文档补充**:
    - 新增 `docs/欢迎界面处理流程.md`：启动决策、连接流程（VID/PID 过滤）、isConnecting 遮罩、错误处理、状态变量。
    - 新增 `docs/方位检测处理流程.md`：commitFrame 六阶段管线、4 种 Compass 模式、DEFAULT_MAP 方向映射、最短旋转路径插值。
    - 新增 `docs/空间校准处理流程.md`：零校准/方向校准完整流程、Cramer 法则矩阵求解推导、"确认并应用"按钮逻辑。
    - 新增 `docs/系统配置处理流程.md`：Props 列表、本地缓冲模式、阈值关系、开发者模式入口。
    - 新增 `docs/调试分析处理流程.md`：3 列布局、三圆盘、DSP 窗口拖拽、暂停机制、与空间校准对比。
    - 更新 `CLAUDE.md`：补充 `stateRef.samplingStep`、`zeroCalibEverRun`、自适应阈值、DebugChart 新布局等。
    - 新增 `docs/短路测试仪架构流程图.drawio`：顶层的 5 分支架构总图。
