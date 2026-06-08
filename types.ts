//types.ts文件定义了数据类型，包括语言类型、主题类型、数据类型、通信接口类型

export type Language = 'en' | 'zh';
export type ThemeMode = 'dark' | 'light';

// 每帧数据点数量
export const POINTS_PER_FRAME = 100;

/**
 * 核心导航数据载体，主罗盘界面的数据载体
 */
export interface CompassData {
  q0: number; // 经过“零点校准”和“空间仿射矩阵校正”后的 Q0 通道磁通幅度值
  q1: number; // 经过“零点校准”和“空间仿射矩阵校正”后的 Q1 通道磁通幅度值
  rawQ0: number; // 未经仿射矩阵校正，但已包含零点偏置补偿的 Q0 原始值
  rawQ1: number; // 未经仿射矩阵校正，但已包含零点偏置补偿的 Q1 原始值
  q0Bit: number; // Q0 通道窗口中心点的硬件同步相位标志位（通常为 0 或 1）
  q1Bit: number; // Q1 通道窗口中心点的硬件同步相位标志位（通常为 0 或 1）
  heading: number; // 计算得出的罗盘地理指向角度（0°~360°，以北为 0°，顺时针增加）
  magnitude: number; // 二维空间磁通合成矢量的模长（强度），公式为：sqrt(q0^2 + q1^2)
  rawCode: string; // 原始方波同步码（如 "1010"），结合两个通道的 flag1/flag2 状态进行诊断
  status?: string; // 设备当前状态，通常为 "Active"（连接中）、"Disconnected"（表笔悬空）或 "Waiting"（等待数据）
  balanceFactor?: number; // 轴平衡补偿系数，Q1 与 Q0 两通道灵敏度的比值
  axisToCompensate?: 'Q0' | 'Q1' | 'NONE'; // 灵敏度较低的轴（预留字段）
}

/**
 * DebugPoint 代表示波器中单个采样点的数据结构，一帧数据（100 个点）就是由 100 个 DebugPoint 组成的数组
 * 作用：用于在主界面下方的调试区实时显示信号波形
 */
export interface DebugPoint {
  value: number; // 采样值：代表硬件在这一瞬间采集到的模拟电压信号（即磁通量大小的裸数据）
  flag1: number; // 同步标志位 1（当前加密协议固定为 0，旧文本协议中由硬件提供）
  flag2: number; // 同步标志位 2（当前加密协议固定为 0，旧文本协议中由硬件提供）
  index: number; // 点索引：代表这个采样点在一帧（100 个点）中的时间先后顺序位置（范围 0 到 99）
}

/**
 * 串口 API 接口类型，提供了打开、关闭串口、读写流等方法，是对浏览器原生 SerialPort 的类型抽象，
 * 用于在不安装 @types/w3c-web-serial的情况下获得类型检查
 */
export interface SerialPort {
  open(options: SerialOptions): Promise<void>; // 打开串口并配置参数
  close(): Promise<void>; // 关闭串口
  readable: ReadableStream<any> | null; // 可读流：用于接收从串口读取数据的接口
  writable: WritableStream<any> | null; // 可写流：用于向串口写入数据的接口
}

/**
 * 串口配置选项类型，定义了串口通信时的各项参数
 */
export interface SerialOptions {
  baudRate: number; // 波特率：串口通信的速率（每秒传输的位数）
  dataBits?: number; // 数据位数：每个字节包含的数据位数（通常为 8）
  stopBits?: number; // 停止位数：每个字节包含的停止位数（通常为 1）
  parity?: 'none' | 'even' | 'odd'; // 校验位：用于数据校验的位（无校验、偶校验、奇校验）
  bufferSize?: number; // 内部读取缓冲区字节数，影响单次读取的数据量
  flowControl?: 'none' | 'hardware'; // 流控制：用于控制数据传输的流控制（无流控制、硬件流控制）
}
