import { DebugPoint } from '../types';

// 窗口化修剪均值算法的核心参数
export const WINDOW_SIZE = 32;         // 采样窗口：从 103 点帧中取 32 个连续点
export const TRIM_COUNT = 6;            // 修剪数量：两端各剔除 6 个极值点（6/32 = 18.75%）
export const WINDOW_CENTER_OFFSET = Math.floor(WINDOW_SIZE / 2); // 窗口中心偏移（16 点）

// 预分配排序缓冲区，复用避免 GC 抖动（每帧调用 2 次，60Hz 采样率下每秒 120 次排序）
const sharedSortBuffer = new Float64Array(WINDOW_SIZE);

/**
 * 窗口化修剪平均值 — 核心降噪算法
 * 从帧数据中取 32 点窗口 → 排序 → 掐头去尾各 6 个离群值 → 中间 20 点取平均
 * 消除表笔滑动摩擦电瞬态毛刺，保持极低相位延迟
 */
export const getWindowAvg = (frame: DebugPoint[], startIndex: number, offset: number) => {
    let count = 0;
    // 环形缓冲区采样：从 startIndex 开始取 WINDOW_SIZE 个点
    for (let i = 0; i < WINDOW_SIZE; i++) {
        const idx = (startIndex + i) % frame.length;
        if (frame[idx]) {
            sharedSortBuffer[count++] = frame[idx].value + offset;
        }
    }
    if (count < WINDOW_SIZE) return 0;  // 数据不足，返回 0
    sharedSortBuffer.sort();            // 升序排列
    let sum = 0;
    const end = WINDOW_SIZE - TRIM_COUNT;  // 有效区间终点（32-6=26）
    for (let i = TRIM_COUNT; i < end; i++) {  // i=6..25（中间 20 个有效点）
        sum += sharedSortBuffer[i];
    }
    return sum / (WINDOW_SIZE - TRIM_COUNT * 2);  // 返回 20 点均值
};
