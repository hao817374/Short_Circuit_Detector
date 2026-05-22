# Short Circuit Detector v1.0.9 版本说明

## 交互优化

- **DEBUG 视图上半部布局重构**:
    - 三列重新分配：第1列仅返回按钮，第2列三圆盘纵向排列+暂停按钮居中，第3列三行校准网格（零点校准/右上采集/右下采集）。
    - 零校准按钮支持中/英文切换（此前硬编码英文 "ZERO CALIB"）。
    - SW 采集箭头修正：ArrowDownLeft→ArrowDownRight，NW 采集箭头：ArrowUpLeft→ArrowUpRight。
    - 移除 Q0/Q1 offset 输入框，校准结果标签改为 "Q0:/Q1:" 格式，数值宽度统一。
    - 三圆盘尺寸 128px→160px，上半部最小高度提升至 280px。
