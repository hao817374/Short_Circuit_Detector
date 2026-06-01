// ChaCha20 解密模块 (RFC 8439)
// 与 STM32 单片机端共享密钥，用于解密串口加密数据帧

// 256 位对称密钥（与 MCU 端一致）
export const CHACHA20_KEY = new Uint8Array([
  0x4F, 0x2B, 0x8D, 0xE1, 0x73, 0xA9, 0x56, 0xC0,
  0x1D, 0x6E, 0xF4, 0x82, 0x3B, 0x97, 0xD5, 0x0A,
  0xE8, 0x64, 0x1F, 0xCB, 0x50, 0xA3, 0x7E, 0x29,
  0x86, 0xD0, 0x45, 0xFC, 0x17, 0xB3, 0x69, 0x2C
]);

// 将 4 字节 Uint8Array 转为 uint32 (小端序)
const leToU32 = (b: Uint8Array, off: number): number =>
  b[off] | (b[off + 1] << 8) | (b[off + 2] << 16) | (b[off + 3] << 24);

// 将 uint32 写入 Uint8Array (小端序)
const u32ToLe = (n: number, b: Uint8Array, off: number) => {
  b[off] = n & 0xff;
  b[off + 1] = (n >>> 8) & 0xff;
  b[off + 2] = (n >>> 16) & 0xff;
  b[off + 3] = (n >>> 24) & 0xff;
};

// ChaCha20 1/4 轮：4 次 ARX (Add-Rotate-XOR) 操作
const qround = (st: Uint32Array, a: number, b: number, c: number, d: number) => {
  st[a] = (st[a] + st[b]) >>> 0; st[d] ^= st[a]; st[d] = ((st[d] << 16) | (st[d] >>> 16)) >>> 0;
  st[c] = (st[c] + st[d]) >>> 0; st[b] ^= st[c]; st[b] = ((st[b] << 12) | (st[b] >>> 20)) >>> 0;
  st[a] = (st[a] + st[b]) >>> 0; st[d] ^= st[a]; st[d] = ((st[d] << 8) | (st[d] >>> 24)) >>> 0;
  st[c] = (st[c] + st[d]) >>> 0; st[b] ^= st[c]; st[b] = ((st[b] << 7) | (st[b] >>> 25)) >>> 0;
};

// 生成 64 字节密钥流块
const chacha20Block = (key: Uint8Array, counter: number, nonce: Uint8Array): Uint8Array => {
  // 初始状态: 常量 (4) + 密钥 (8) + 计数器 (1) + Nonce (3) = 16 个 uint32
  const st = new Uint32Array(16);
  st[0] = 0x61707865; st[1] = 0x3320646e; st[2] = 0x79622d32; st[3] = 0x6b206574;
  st[4] = leToU32(key, 0);   st[5] = leToU32(key, 4);
  st[6] = leToU32(key, 8);   st[7] = leToU32(key, 12);
  st[8] = leToU32(key, 16);  st[9] = leToU32(key, 20);
  st[10] = leToU32(key, 24); st[11] = leToU32(key, 28);
  st[12] = counter;
  st[13] = leToU32(nonce, 0);
  st[14] = leToU32(nonce, 4);
  st[15] = leToU32(nonce, 8);

  const working = new Uint32Array(st);
  // 20 轮 = 10 次双轮（列操作 + 对角线操作）
  for (let i = 0; i < 10; i++) {
    qround(working, 0, 4, 8, 12);   // 列
    qround(working, 1, 5, 9, 13);
    qround(working, 2, 6, 10, 14);
    qround(working, 3, 7, 11, 15);
    qround(working, 0, 5, 10, 15);  // 对角线
    qround(working, 1, 6, 11, 12);
    qround(working, 2, 7, 8, 13);
    qround(working, 3, 4, 9, 14);
  }

  // 初始状态 + 工作状态 = 最终密钥流
  const out = new Uint8Array(64);
  for (let i = 0; i < 16; i++) {
    u32ToLe((st[i] + working[i]) >>> 0, out, i * 4);
  }
  return out;
};

// 从会话 ID + seq_num 派生 12 字节 Nonce: sessionId(8B) + seqNum(4B LE)
const deriveNonce = (sessionId: Uint8Array, seqNum: number): Uint8Array => {
  const nonce = new Uint8Array(12);
  nonce.set(sessionId, 0);        // 前 8 字节 = 会话 ID（连接时随机生成）
  u32ToLe(seqNum, nonce, 8);      // 后 4 字节 = seq_num 小端序
  return nonce;
};

// 解密 200 字节加密载荷 → 返回 200 字节明文
// ChaCha20 是流密码，加密与解密是同一操作（密钥流 XOR 密文）
export const decryptPayload = (encrypted: Uint8Array, seqNum: number, sessionId: Uint8Array): Uint8Array => {
  const plaintext = new Uint8Array(200);
  const nonce = deriveNonce(sessionId, seqNum);

  // 200 字节需要 ceil(200/64) = 4 个密钥流块（最后一个块只用前 8 字节）
  for (let blockIdx = 0; blockIdx < 4; blockIdx++) {
    const keystream = chacha20Block(CHACHA20_KEY, blockIdx, nonce);
    const offset = blockIdx * 64;
    const chunkSize = Math.min(64, 200 - offset);
    for (let i = 0; i < chunkSize; i++) {
      plaintext[offset + i] = encrypted[offset + i] ^ keystream[i];
    }
  }

  return plaintext;
};
