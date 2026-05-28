
export type Language = 'en' | 'zh';
export type ThemeMode = 'dark' | 'light';

export interface CompassData {
  q0: number;
  q1: number;
  rawQ0: number; // uncorrected data
  rawQ1: number; // uncorrected data
  q0Bit: number;
  q1Bit: number;
  heading: number; // Derived angle based on bits
  magnitude: number; // sqrt(q0^2 + q1^2)
  rawCode: string;
  status?: string; // Optional status field for UI
  balanceFactor?: number; // 轴平衡补偿系数
  axisToCompensate?: 'Q0' | 'Q1' | 'NONE'; // 哪根轴被补偿了
}

// New Debug Data Type
export interface DebugPoint {
  value: number;
  flag1: number;
  flag2: number;
  index: number;
}

// Web Serial API Types
export interface SerialPort {
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<any> | null;
  writable: WritableStream<any> | null;
}

export interface SerialOptions {
  baudRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}
