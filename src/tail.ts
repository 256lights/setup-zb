// Copyright 2026 The zb Authors
// SPDX-License-Identifier: MIT

import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { Stream } from 'node:stream';

/**
 * Create a {@link Readable} that follows the contents of a file
 * until an error is encountered or the signal is aborted.
 */
export function tail(filename: string, signal?: AbortSignal): Readable {
  return new TailReadable(filename, { signal });
}

class TailReadable extends Readable {
  private readonly filename: string;
  private readonly abortController: AbortController;
  private readonly signal: AbortSignal;

  private fd?: fs.FileHandle;
  private watcher?: AsyncIterator<fs.FileChangeInfo<string>>;

  constructor(filename: string, options: Stream.ReadableOptions) {
    super({
      // Match FileHandle.createReadStream default.
      highWaterMark: 64 * 1024,
      ...options,
    });
    this.filename = filename;

    this.abortController = new AbortController();
    const signals = [this.abortController.signal];
    if (options.signal) {
      signals.push(options.signal);
    }
    this.signal = AbortSignal.any(signals);
  }

  override _construct(callback: (error?: Error | null) => void): void {
    (async () => {
      try {
        [this.fd, this.watcher] = await Promise.all([
          fs.open(this.filename),
          fs.watch(this.filename, {
            signal: this.signal,
          }),
        ]);
        callback();
      } catch (err) {
        callback(toError(err));
      }
    })();
  }


  override _read(size: number): void {
    (async () => {
      try {
        const buffer = Buffer.alloc(size);
        for (;;) {
          const { bytesRead } = await this.fd!.read({buffer});
          if (bytesRead > 0) {
            this.push(buffer.subarray(0, bytesRead));
            return;
          }
          if (!this.watcher) {
            this.push(null);
            return;
          }
          const result = await this.watcher.next();
          if (result.done) {
            delete this.watcher;
            // Watcher aborted. Read any remaining data in the file.
            continue;
          }
          if (result.value.eventType !== 'change') {
            throw new Error(`Unhandled ${result.value.eventType} file event`);
          }
        }
      } catch (err) {
        this.destroy(toError(err));
      }
    })();
  }

  override _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    (async () => {
      const promises: Promise<void>[] = [];
      if (this.fd) {
        promises.push(this.fd.close());
      }
      if (this.watcher) {
        const w = this.watcher;
        this.abortController.abort();
        promises.push((async () => {
          for (;;) {
            const { done } = await w.next();
            if (done) {
              return;
            }
          }
        })());
      }

      const results = await Promise.allSettled(promises);
      if (error) {
        callback(error);
        return;
      }
      for (const r of results) {
        if (r.status === 'rejected' && r.reason) {
          callback(toError(r.reason));
          return;
        }
      }
      callback();
    })();
  }
}

function toError(x: any): Error {
  return x instanceof Error ? x : new Error(Object.prototype.toString.call(x));
}
