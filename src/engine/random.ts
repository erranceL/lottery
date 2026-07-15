/**
 * 确定性随机工具。
 *
 * 演示环境使用固定种子保证同一票号永远得到同一票面；
 * 生产环境应替换为服务端安全随机源并存档种子摘要。
 */

/** splitmix32：种子扩展 */
export function splitmix32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    z = z ^ (z >>> 15);
    return (z >>> 0) / 4294967296;
  };
}

/** 生成 [0, n) 的整数 */
export function nextInt(rng: () => number, n: number): number {
  if (!Number.isSafeInteger(n) || n <= 0) {
    throw new RangeError(`nextInt 的上界必须是正整数：${n}`);
  }
  return Math.min(n - 1, Math.floor(rng() * n));
}

/** 32 位混合哈希，用于派生子种子 */
export function mix(a: number, b: number): number {
  let h = (a ^ Math.imul(b, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

/**
 * 基于 Feistel 网络的确定性置换，域为 [0, size)。
 * 使用 cycle-walking 处理非 2 的幂大小；4 轮足够打散演示用途。
 * 该置换是双射：每个票号恰好映射到一个唯一桶位。
 */
export class FeistelPermutation {
  readonly size: number;
  private readonly halfBits: number;
  private readonly halfMask: number;
  private readonly keys: number[];

  constructor(size: number, seed: number) {
    // 有符号 32 位位移限制：域上限 2^30，足够覆盖百万级票池
    if (!Number.isSafeInteger(size) || size < 1 || size > 2 ** 30) {
      throw new RangeError(`置换域大小必须在 [1, 2^30]：${size}`);
    }
    this.size = size;
    let bits = 1;
    while (1 << bits < size) bits++;
    if (bits % 2 === 1) bits++;
    this.halfBits = bits / 2;
    this.halfMask = (1 << this.halfBits) - 1;
    this.keys = [];
    for (let i = 0; i < 4; i++) this.keys.push(mix(seed, 0x9e3779b9 + i));
  }

  private round(value: number): number {
    let x = value;
    for (const key of this.keys) {
      const left = x >>> this.halfBits;
      const right = x & this.halfMask;
      const f = mix(right, key) & this.halfMask;
      x = ((right << this.halfBits) | (left ^ f)) >>> 0;
    }
    return x;
  }

  /** 将 index 映射到唯一桶位（cycle-walking 保证结果落在 [0, size)） */
  map(index: number): number {
    if (index < 0 || index >= this.size) {
      throw new RangeError(`index ${index} out of domain [0, ${this.size})`);
    }
    let x = this.round(index);
    // Feistel 是 [0, domain) 上的双射，反复走圈必然回到 [0, size)
    while (x >= this.size) x = this.round(x);
    return x;
  }
}
