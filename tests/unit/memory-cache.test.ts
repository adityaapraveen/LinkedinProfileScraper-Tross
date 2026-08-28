import { describe, expect, it } from 'vitest';
import { MemoryCache } from '../../src/infrastructure/cache/memory-cache.js';

describe('MemoryCache', () => {
  it('returns cache hits and misses', async () => {
    const cache = new MemoryCache();
    await expect(cache.get('missing')).resolves.toBeNull();
    await cache.set('key', { value: 1 }, 60);
    await expect(cache.get('key')).resolves.toEqual({ value: 1 });
  });

  it('expires entries by TTL', async () => {
    let now = 1000;
    const cache = new MemoryCache(() => now);
    await cache.set('key', 'value', 1);
    now = 2000;
    await expect(cache.get('key')).resolves.toBeNull();
  });

  it('deletes entries', async () => {
    const cache = new MemoryCache();
    await cache.set('key', 'value', 60);
    await cache.delete('key');
    await expect(cache.get('key')).resolves.toBeNull();
  });
});
