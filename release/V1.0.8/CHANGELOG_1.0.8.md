# Short Circuit Detector v1.0.8 版本说明

## 缺陷修复

- **"清除校准"按钮零点校准数据残留**:
    - 修复点击"清除校准"后零点校准结果卡片（Q0/Q1/BIAS 数值）及状态文字未被清除的问题。
    - `resetCalibration()` 中新增 `setZeroCalibResult(null)` 和 `setZeroCalibStatus('IDLE')`，确保零校准 UI 与方向校准 UI 同步清除。

## 交互优化

- **方向校准按钮顺序调整**:
    - CALIBRATION 页面方向校准卡片中，"右上角激励源"按钮移至上方，"右下角激励源"按钮移至下方，与开发板物理布局一致。
