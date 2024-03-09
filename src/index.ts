import _Promise2 from './promise2';

interface Promise2Constructor {
  readonly prototype: Promise2<unknown, unknown>;

  new <Ok, Fail>(
    executable: (
      success: (val: Ok | _Promise2<Ok, Fail>) => void,
      fail: (val: Fail | _Promise2<Ok, Fail>) => void,
      err: (err: unknown | _Promise2<Ok, Fail>) => void
    ) => void
  ): _Promise2<Ok, Fail>;

  succeed<T>(value: T): T extends _Promise2<infer Ok, infer Fail> ? _Promise2<Ok, Fail> : _Promise2<T, never>;

  fail<T>(value: T): T extends _Promise2<infer Ok, infer Fail> ? _Promise2<Ok, Fail> : _Promise2<never, T>;

  throw(err: unknown): _Promise2<never, never>;

  fromPromise<T, R extends boolean = false>(
    pr: PromiseLike<T>,
    rejectToFail?: R
  ): _Promise2<T, R extends false ? never : unknown>;

  all: typeof Promise.all;
  race: typeof Promise.race;
  allSettled: typeof Promise.allSettled;
  resolve: typeof Promise.resolve;
  reject: typeof Promise.reject;
}

const Promise2: Promise2Constructor = _Promise2 as unknown as Promise2Constructor;
type Promise2<Ok, Fail> = typeof _Promise2<Ok, Fail>;

export = Promise2;
