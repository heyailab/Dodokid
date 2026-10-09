/**
 * mediaBase 单测：三级取值优先级、降级不抛错、以及「数据文件不得残留占位域名」的回归防护。
 *
 * 重点是最后一条扫文件断言 —— 把「不要把媒体域名写死在前端」这条约定固化成测试，
 * 防止后续有人新增数据文件时又写回 example.com 占位地址。
 */
import fs from 'fs';
import path from 'path';
import {
  FALLBACK_MEDIA_BASE,
  getMediaBase,
  initMediaBase,
  mediaUrl,
  setMediaBase,
  subscribeMediaBase,
} from '../shared/lib/mediaBase';
import { ENGLISH_WORDS } from '../features/english/englishData';
import { LITERACY_CARDS } from '../features/literacy/literacyData';
import { BOOK_SEEDS, resolveBook } from '../api/mockBooks';

const SRC = path.resolve(__dirname, '..');
const ENV_KEY = 'EXPO_PUBLIC_MEDIA_BASE_URL';

/** 每个用例前后都清干净运行时缓存与env，避免相互串味 */
function resetMediaBase(env?: string): void {
  setMediaBase(null);
  if (env === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = env;
}

/** 造一个只返回指定 payload 的 fetch 替身 */
function fakeFetch(payload: unknown, ok = true): typeof fetch {
  return jest.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
    text: async () => (typeof payload === 'string' ? payload : JSON.stringify(payload)),
  })) as unknown as typeof fetch;
}

afterEach(() => {
  resetMediaBase();
  jest.restoreAllMocks();
});

describe('mediaBase 三级取值优先级', () => {
  it('第 3 级：无运行时值、无env 时用兜底常量', () => {
    resetMediaBase();
    expect(getMediaBase()).toBe(FALLBACK_MEDIA_BASE);
    expect(mediaUrl('english/e-cake.mp3')).toBe(
      `${FALLBACK_MEDIA_BASE}/english/e-cake.mp3`,
    );
  });

  it('第 2 级：有 env 时用env，且被 setMediaBase(null) 清空后回落', () => {
    resetMediaBase('https://env.example.org/media/');
    expect(getMediaBase()).toBe('https://env.example.org/media');
    expect(mediaUrl('a/b.mp3')).toBe('https://env.example.org/media/a/b.mp3');

    // 清掉运行时缓存不应清掉 env，env 是构建期覆盖
    setMediaBase(null);
    expect(getMediaBase()).toBe('https://env.example.org/media');
  });

  it('第 1 级：运行时值同时压过 env 与兜底常量', () => {
    resetMediaBase('https://env.example.org/media');
    setMediaBase('https://runtime.example.net/media/');
    expect(getMediaBase()).toBe('https://runtime.example.net/media');
    expect(mediaUrl('english/e-cat.mp3')).toBe(
      'https://runtime.example.net/media/english/e-cat.mp3',
    );
  });

  it('空串 / 纯空白视为未设置，不污染缓存', () => {
    resetMediaBase();
    setMediaBase('   ');
    expect(getMediaBase()).toBe(FALLBACK_MEDIA_BASE);
  });
});

describe('mediaUrl 拼接规则', () => {
  beforeEach(() => resetMediaBase('https://base.test/media'));

  it('去掉基址尾部斜杠，不出双斜杠', () => {
    expect(mediaUrl('english/e-sun.mp3')).toBe('https://base.test/media/english/e-sun.mp3');
    setMediaBase('https://base.test/media///');
    expect(mediaUrl('english/e-sun.mp3')).toBe(
      'https://base.test/media/english/e-sun.mp3',
    );
  });

  it('原样返回绝对地址，避免重复拼接', () => {
    expect(mediaUrl('https://cdn.other.com/x.mp3')).toBe('https://cdn.other.com/x.mp3');
    expect(mediaUrl('http://cdn.other.com/x.mp3')).toBe('http://cdn.other.com/x.mp3');
  });

  it('原样返回本地与 mock 协议 —— 离线缓存产物不能被拼坏', () => {
    expect(mediaUrl('file:///data/user/0/a.mp3')).toBe('file:///data/user/0/a.mp3');
    expect(mediaUrl('mock://audio/0')).toBe('mock://audio/0');
    // 前导斜杠视为设备上的绝对路径（lib/offline 的本地缓存），不是相对 key
    expect(mediaUrl('/data/local/a.mp3')).toBe('/data/local/a.mp3');
  });

  it('空串返回空串，便于调用方隐藏音频按钮', () => {
    expect(mediaUrl('')).toBe('');
    expect(mediaUrl('   ')).toBe('');
  });
});

describe('initMediaBase 降级行为', () => {
  it('成功时写入运行时缓存（兼容 {data:…} 外壳）', async () => {
    resetMediaBase();
    await expect(
      initMediaBase(fakeFetch({ data: { latest: '1.0.0', mediaBaseUrl: 'https://new.cdn.cn/media' } })),
    ).resolves.toBeUndefined();
    expect(getMediaBase()).toBe('https://new.cdn.cn/media');
    expect(mediaUrl('english/e-dog.mp3')).toBe('https://new.cdn.cn/media/english/e-dog.mp3');
  });

  it('成功时也兼容裸对象响应体', async () => {
    resetMediaBase();
    await initMediaBase(fakeFetch({ mediaBaseUrl: 'https://bare.cn/media' }));
    expect(getMediaBase()).toBe('https://bare.cn/media');
  });

  it('请求失败（网络异常）时静默降级，不抛错', async () => {
    resetMediaBase();
    await expect(
      initMediaBase(jest.fn(async () => {
        throw new Error('network down');
      }) as unknown as typeof fetch),
    ).resolves.toBeUndefined();
    expect(getMediaBase()).toBe(FALLBACK_MEDIA_BASE);
  });

  it('非 2xx 时不覆盖缓存', async () => {
    resetMediaBase();
    await initMediaBase(fakeFetch({ mediaBaseUrl: 'https://x.cn/media' }, false));
    expect(getMediaBase()).toBe(FALLBACK_MEDIA_BASE);
  });

  it('字段缺失 / 类型不对 / JSON 非法 均降级不抛错', async () => {
    resetMediaBase();
    await initMediaBase(fakeFetch({ data: { latest: '1.0.0' } }));
    expect(getMediaBase()).toBe(FALLBACK_MEDIA_BASE);

    await initMediaBase(fakeFetch({ data: { mediaBaseUrl: 123 } }));
    expect(getMediaBase()).toBe(FALLBACK_MEDIA_BASE);

    await expect(initMediaBase(fakeFetch('{ not json'))).resolves.toBeUndefined();
    expect(getMediaBase()).toBe(FALLBACK_MEDIA_BASE);
  });

  it('基址变化时通知订阅者；未变化时不通知', () => {
    resetMediaBase();
    const listener = jest.fn();
    const unsubscribe = subscribeMediaBase(listener);

    setMediaBase('https://a.cn/media');
    expect(listener).toHaveBeenCalledTimes(1);

    setMediaBase('https://a.cn/media');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setMediaBase('https://b.cn/media');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

/** 递归列出 src 下所有 .ts / .tsx（跳过测试自身） */
function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(full);
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (/\.test\.tsx?$/.test(entry.name)) return [];
    return [full];
  });
}

describe('占位域名回归防护', () => {
  it('数据文件与 mock 中不得残留 example.com', () => {
    const offenders = listSourceFiles(SRC).filter((file) => {
      const text = fs.readFileSync(file, 'utf8');
      // mediaBase 的兜底常量是真实域名，不在排查范围；这里只查占位域名
      return /cdn\.dodokid\.example\.com|dodokid\.example\.com/.test(text);
    });
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it('英文 / 识字数据只存相对 key，不含任何域名', () => {
    for (const w of ENGLISH_WORDS) expect(w.audioKey).not.toMatch(/[:/]{2}/);
    for (const c of LITERACY_CARDS) expect(c.audioKey).not.toMatch(/[:/]{2}/);
  });

  it('mock 种子只存相对 key', () => {
    expect(BOOK_SEEDS.every((s) => !s.coverKey.includes('://'))).toBe(true);
    expect(
      BOOK_SEEDS.every((s) => s.pages.every((p) => !p.imageKey.includes('://') && !p.audioKey.includes('://'))),
    ).toBe(true);
  });

  /**
   * 本次改动的核心回归点：拼接必须发生在**请求/渲染时**，
   * 而不是模块加载时。若有人把 resolveBook 的结果提前缓存成常量，
   * 基址更新后这里就会拿到旧域名。
   */
  it('resolveBook 每次调用都读当前基址，不被模块加载时的值锁死', () => {
    resetMediaBase('https://first.cn/media');
    const before = resolveBook(BOOK_SEEDS[0]!);
    expect(before.coverUrl).toBe(`https://first.cn/media/${BOOK_SEEDS[0]!.coverKey}`);

    setMediaBase('https://second.cn/media');
    const after = resolveBook(BOOK_SEEDS[0]!);
    expect(after.coverUrl).toBe(`https://second.cn/media/${BOOK_SEEDS[0]!.coverKey}`);
    expect(after.pages[0]!.audioUrl).toBe(
      `https://second.cn/media/${BOOK_SEEDS[0]!.pages[0]!.audioKey}`,
    );
    // 旧对象不被就地改写，避免已渲染的界面拿到「半新半旧」的地址
    expect(before.coverUrl).toBe(`https://first.cn/media/${BOOK_SEEDS[0]!.coverKey}`);
  });
});