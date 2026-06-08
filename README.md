# 短路测试仪上位机软件

基于 **Electron + React + TypeScript + TailwindCSS** 开发的高精度 PCB 短路点定位仪器。

## 工作原理

硬件探头通过四个测试夹向 PCB 注入激励信号，双通道 ADC 采集电场梯度数据。上位机通过串口接收加密数据帧，经 DSP 降噪、校准矩阵校正、矢量合成后，在罗盘 HUD 上实时显示短路点的方位和距离，引导工程师逐级逼近故障位置。

## 主要功能

- **方位检测** — 罗盘 HUD 实时指向短路点方向，4 种模式（离线/表笔断开/短路附近/导航中），最短旋转路径平滑指针动画
- **空间校准** — 零点校准（消除 PCB 静态偏置）+ 双点方向校准（Cramer 法则求解 2×2 仿射变换矩阵），补偿通道灵敏度差异和串扰
- **实时波形** — 示波器单帧波形显示，可拖拽 WIN1/WIN2 双窗口，可视化 DSP 修剪均值滤波区间
- **加密通信** — ChaCha20 流密码加密串口数据，握手协议 + 会话 ID 防止 Nonce 重用
- **开发者模式** — 隐藏调试视图，可调整核心算法参数（DSP 窗口、偏移量、校准矩阵）
- **中英文切换** — 界面完整支持中文/英文，持久化语言偏好
- **暗色主题** — 支持亮色/暗色模式切换
- **自动重连** — 启动时自动匹配 VID/PID 连接已知设备，设备插拔事件监听

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Electron 29 |
| UI 框架 | React 18 + TypeScript 5 |
| 构建工具 | Vite 5 |
| 样式 | TailwindCSS 3（暗色模式 `class` 策略） |
| 图标 | lucide-react |
| 字体 | Inter + JetBrains Mono |
| 串口 | Web Serial API |
| 加密 | ChaCha20 (RFC 8439) |
| DSP | 窗口化修剪均值（32 点窗口，18.75% 修剪率） |

## 项目结构

```
Short_Circuit_Detector/
├── App.tsx                          # 应用中枢（串口管理、数据管线、校准算法）
├── types.ts                         # 全局类型定义
├── index.tsx                        # React 入口
├── index.html                       # HTML 模板
├── index.css                        # Tailwind 样式入口
├── components/
│   ├── Compass.tsx                  # 罗盘 HUD 组件
│   ├── CalibrationView.tsx          # 空间校准视图
│   ├── DebugChart.tsx               # 调试示波器视图
│   ├── Settings.tsx                 # 系统配置视图
│   └── WelcomeScreen.tsx            # 启动引导屏
├── utils/
│   ├── dsp.ts                       # 核心 DSP 算法（窗口化修剪均值）
│   ├── binaryProtocol.ts            # 二进制加密帧解析器
│   └── chacha20.ts                  # ChaCha20 流密码实现
├── electron/
│   └── main.cjs                     # Electron 主进程
├── docs/
│   ├── 方位检测处理流程.md
│   ├── 空间校准处理流程.md
│   ├── 欢迎界面处理流程.md
│   ├── 调试分析处理流程.md
│   ├── 系统配置处理流程.md
│   └── chacha20加解密流程.md
├── 短路测试仪底层原理技术总结.md     # 硬件/原理层面技术总结
├── package.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## 数据流概览

```
硬件探头 → USB 串口(115200bps)
  → 握手协议（SessionID 协商，3 次重试）
  → 206 字节加密帧（0xAA + seqNum + ChaCha20 载荷 + 校验和）
  → 解密 → 100 点 ADC 采样值
  → 窗口化修剪均值降噪（32 取 20）
  → 校准矩阵校正（2×2 仿射变换）
  → atan2 矢量合成 → 罗盘 heading
  → SVG 罗盘 HUD 实时渲染
```

## 开发与运行

```bash
# 安装依赖
npm install

# 纯前端开发模式（浏览器运行，无串口功能）
npm run dev

# Electron 开发模式（完整串口功能，需连接硬件）
npm run electron:dev

# 生产构建 + 打包
npm run electron:build
```

开发模式下 Vite 运行在 `http://localhost:5173`，Electron 窗口自动加载该地址。

## 系统要求

- **操作系统**: Windows 10+ / Linux / macOS
- **Node.js**: 18+
- **硬件**: 需配合短路测试仪硬件探头使用（USB 串口，波特率 115200）

## 许可证

本项目采用 **知识共享 署名-非商业性使用-禁止演绎 4.0 国际许可协议 (CC BY-NC-ND 4.0)**。

仅供个人学习与研究使用，**严禁用于任何商业用途**。
