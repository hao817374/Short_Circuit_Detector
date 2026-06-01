// 二进制加密帧解析器
// 帧格式: 0xAA (1B) | seq_num LE (4B) | 加密载荷 (200B) | 校验和 (1B) = 206 字节
// 解密后载荷 = 100 个 int16 LE = 100 个 ADC 采样值

import { DebugPoint, POINTS_PER_FRAME } from '../types';
import { decryptPayload } from './chacha20';

const FRAME_SIZE = 206;
const PAYLOAD_SIZE = 200;
const FRAME_HEADER = 0xAA;

// 计算校验和：前 205 字节累加取低 8 位
const computeChecksum = (frame: Uint8Array): number => {
  let sum = 0;
  for (let i = 0; i < 205; i++) sum += frame[i];
  return sum & 0xFF;
};

// 从 4 字节提取 uint32 (小端序)
const readU32LE = (b: Uint8Array, off: number): number =>
  b[off] | (b[off + 1] << 8) | (b[off + 2] << 16) | (b[off + 3] << 24);

// 从 2 字节提取 int16 (小端序)
const readI16LE = (b: Uint8Array, off: number): number => {
  const val = b[off] | (b[off + 1] << 8);
  return val >= 0x8000 ? val - 0x10000 : val;
};

// 尝试解析二进制帧，成功返回 DebugPoint[]，失败返回 null（校验和不匹配）
export const tryParseFrame = (frame: Uint8Array): DebugPoint[] | null => {
  if (frame.length !== FRAME_SIZE) return null;
  if (frame[0] !== FRAME_HEADER) return null;
  if (frame[205] !== computeChecksum(frame)) return null;

  const seqNum = readU32LE(frame, 1);          // 字节 1-4：序列号
  const encrypted = frame.slice(5, 205);       // 字节 5-204：加密载荷
  const plaintext = decryptPayload(encrypted, seqNum);

  // 还原 100 个 int16 ADC 值 → DebugPoint[]
  const points: DebugPoint[] = [];
  for (let i = 0; i < POINTS_PER_FRAME; i++) {
    points.push({
      index: i,
      value: readI16LE(plaintext, i * 2),
      flag1: 0,
      flag2: 0,
    });
  }
  return points;
};

// 从字节缓冲区扫描并提取第一个有效帧
// 返回 { points, consumed } — consumed 是消耗的字节数（跳到帧尾后）
// 如果没找到有效帧，返回 null（保留缓冲区等待更多数据）
export const scanFrame = (buffer: Uint8Array): { points: DebugPoint[]; consumed: number } | null => {
  if (buffer.length < FRAME_SIZE) return null;

  for (let i = 0; i <= buffer.length - FRAME_SIZE; i++) {
    if (buffer[i] !== FRAME_HEADER) continue;

    const frame = buffer.slice(i, i + FRAME_SIZE);
    const points = tryParseFrame(frame);
    if (points) {
      return { points, consumed: i + FRAME_SIZE };
    }
    // 校验失败，继续扫描下一个 0xAA
  }

  // 没找到完整有效帧，保留最后 FRAME_SIZE-1 字节（可能含部分帧头）
  return null;
};
