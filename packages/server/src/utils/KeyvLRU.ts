// Create ~about~ a 30MiB LRU. This is less than precise
// since the technique to calculate the size of a DocumentNode is
// only using JSON.stringify on the DocumentNode (and thus doesn't account
// for unicode characters, etc.), but it should do a reasonable job at
// providing a caching document store for most operations.

import LRUCache from 'lru-cache';
import Keyv, { Store, type Options } from 'keyv';
import type { WithRequired } from '@apollo/server-types';

// LRUCache wrapper to implement the Keyv `Store` interface.
export class LRU<V> implements Store<V> {
  private cache: LRUCache<string, V>;

  constructor(lruCacheOpts: LRUCache.Options<string, V>){
    this.cache = new LRUCache(lruCacheOpts);
  };

  set(key: string, value: V, ttl?: number) {
    const result = this.cache.set(key, value, { ttl });
    return result;
  }

  get(key: string) {
    return this.cache.get(key);
  }

  delete(key: string) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  static jsonBytesSizeCalculator<T>(obj: T) {
    return Buffer.byteLength(JSON.stringify(obj), 'utf8');
  }
}

// FIXME Keyv.opts isn't defined in the typings
// Related issue: https://github.com/DefinitelyTyped/DefinitelyTyped/pull/59154
type KeyvClassOpts<T> = WithRequired<
  Options<T>,
  'deserialize' | 'namespace' | 'serialize' | 'store' | 'uri'
>;

export type KeyvWithOpts<T> = Keyv<T> & {
  opts: KeyvClassOpts<T>;
};

export class KeyvLRU<T> extends Keyv<T> implements KeyvWithOpts<T> {
  // @ts-ignore FIXME Keyv.opts isn't defined in the typings. This is a workaround
  // for now that we can remove once they're correct.
  // Related issue: https://github.com/DefinitelyTyped/DefinitelyTyped/pull/59154
  opts: KeyvClassOpts<T>;

  constructor(opts?: Options<T>) {
    super({
      namespace: 'apollo',
      store: new LRU<T>({
        max: Math.pow(2, 20) * 30,
        length(obj) {
          return LRU.jsonBytesSizeCalculator(obj);
        },
      }),
      ...opts,
    });
  }

  getTotalSize() {
    if ('length' in this.opts.store) {
      return (this.opts.store as Store<T> & { length: number }).length;
    }
    throw Error('Keyv.store does not implement length');
  }
}
