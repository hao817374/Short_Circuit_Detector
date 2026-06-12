# Short Circuit Detector v1.1.9 版本说明

## 断开通知帧

- **MCU 会话结束通知**:
    - 断开连接时新增步骤 3.5：在关闭物理串口前，向 MCU 发送 11 字节断开通知帧
    - 帧格式与握手帧一致：`[0x55] [0x03 会话结束] [8B SessionID] [校验和]`
    - MCU 收到后可校验会话 ID 后主动停止数据发送，避免串口缓冲区堆积
    - 端口不可写时静默忽略，不影响正常断开流程

## 详细提交

- App.tsx — 断开通知帧（byeFrame）发送逻辑，位于 reader.cancel() 之后、port.close() 之前
- package.json — 版本号自增至 v1.1.9
