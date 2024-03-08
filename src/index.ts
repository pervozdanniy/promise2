enum State {
  PENDING,
  SUCCESS,
  FAIL,
  ERROR,
}

type Handlers<TS = unknown, TF = unknown> = {
  onSuccess: (value: TS) => void;
  onFail: (value: TF) => void;
  onErr: (err: unknown) => void;
};

type Unwind<T> = T extends Promise2<infer S, infer F> ? Promise2<S, F> : T;

type Handler<T, R> = (val: T) => R extends Promise2<infer S, infer F> ? Promise2<S, F> : R;

type ParamTuple<TS, TF> = [null, TS] | [TF];

export default class Promise2<TSuccess, TFail> implements PromiseLike<ParamTuple<TSuccess, TFail>> {
  static succeed<T>(value: Unwind<T>) {
    if (isPromise2(value)) {
      return value;
    }
    return new Promise2<T, never>((success) => success(value as T));
  }

  static fail<T>(value: T) {
    return new Promise2<never, T>((_, fail) => fail(value));
  }

  static throw(err: unknown) {
    return new Promise2<never, never>((_s, _f, error) => error(err));
  }

  static fromPromise<T>(pr: PromiseLike<T>, rejectToFail = false) {
    return new Promise2<T, typeof rejectToFail extends false ? never : unknown>((success, fail, err) => {
      pr.then(success, rejectToFail ? fail : err);
    });
  }

  static all = Promise.all;
  static race = Promise.race;
  static allSettled = Promise.allSettled;
  static resolve = Promise.resolve;
  static reject = Promise.reject;
  static [Symbol.species] = this;

  #val?: TSuccess | TFail | unknown;
  #state = State.PENDING;
  #handlers: Handlers<TSuccess, TFail>[] = [];
  #handlersExecuted = false;

  #success = (value: TSuccess | unknown) => {
    this.#updateResult(value, State.SUCCESS);
  };
  #fail = (value: TFail | unknown) => {
    this.#updateResult(value, State.FAIL);
  };
  #error = (err: unknown) => {
    this.#updateResult(err, State.ERROR);
  };

  #defaultErrorHandler(err: unknown) {
    // make promise emit 'unhandledRejection'
    Promise.reject(err);
  }

  constructor(
    executable: (success: (val: TSuccess) => void, fail: (val: TFail) => void, err: (err: unknown) => void) => void
  ) {
    executable(this.#success, this.#fail, this.#error);
  }

  #updateResult(val: TSuccess | TFail | unknown, state: State) {
    if (this.#state !== State.PENDING) {
      return;
    }
    if (isPromise2(val)) {
      return val.next(this.#success, this.#fail, this.#error);
    }

    if (isPromiseLike<TSuccess>(val)) {
      return val.then(this.#success, this.#error);
    }

    this.#val = val;
    this.#state = state;

    this.#executeHandlers();
  }

  #executeHandlers() {
    if (this.#state === State.PENDING) {
      return;
    }
    queueMicrotask(() => {
      if (this.#state === State.ERROR && this.#handlers.length === 0 && !this.#handlersExecuted) {
        return this.#defaultErrorHandler(this.#val);
      }
      this.#handlers.forEach((handlers) => {
        const onErr = handlers.onErr ?? this.#defaultErrorHandler;
        if (this.#state === State.SUCCESS) {
          return handlers.onSuccess(this.#val as TSuccess);
        }
        if (this.#state === State.FAIL) {
          return handlers.onFail(this.#val as TFail);
        }
        return onErr(this.#val);
      });
      this.#handlers = [];
      this.#handlersExecuted = true;
    });
  }

  public next<TRes1, TRes2, TRes3>(
    onSuccess?: Handler<TSuccess, TRes1>,
    onFail?: Handler<TFail, TRes2>,
    onErr?: Handler<unknown, TRes3>
  ) {
    return new Promise2<TSuccess | Unwind<TRes1 | TRes3>, TFail | Unwind<TRes2>>((success, fail, error) => {
      const handlers = {
        onSuccess: (value: TSuccess) => {
          if (!onSuccess) {
            return success(value);
          }
          try {
            return success(onSuccess(value));
          } catch (err) {
            return error(err);
          }
        },
        onFail: (value: TFail) => {
          if (!onFail) {
            return fail(value);
          }
          try {
            return fail(onFail(value));
          } catch (err) {
            return error(err);
          }
        },
        onErr: (err: unknown) => {
          if (!onErr) {
            return error(err);
          }
          try {
            return success(onErr(err));
          } catch (err) {
            return error(err);
          }
        },
      };
      this.#handlers.push(handlers);
      this.#executeHandlers();
    });
  }

  public success<TRes1, TRes2>(onSuccess: Handler<TSuccess, TRes1>, onErr?: Handler<unknown, TRes2>) {
    return this.next(onSuccess, undefined, onErr);
  }

  public fail<TRes1, TRes2>(onFail: Handler<TFail, TRes1>, onErr?: Handler<unknown, TRes2>) {
    return this.next(undefined, onFail, onErr);
  }

  public catch<TRes>(onErr: Handler<unknown, TRes>) {
    return this.next(undefined, undefined, onErr);
  }

  then<TResult1 = ParamTuple<TSuccess, TFail>, TResult2 = never>(
    onfulfilled?: ((value: ParamTuple<TSuccess, TFail>) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): PromiseLike<TResult1 | TResult2>;
  public then<TResult1, TResult2>(
    onfulfilled?: (val: ParamTuple<TSuccess, TFail>) => TResult1,
    onrejected?: (err: unknown) => TResult2
  ) {
    return new Promise((resolve, reject) => {
      const handlers = {
        onSuccess: (value: TSuccess) => {
          if (!onfulfilled) {
            return resolve([null, value]);
          }
          try {
            return resolve(onfulfilled([null, value]));
          } catch (err) {
            return reject(err);
          }
        },
        onFail: (value: TFail) => {
          if (!onfulfilled) {
            return resolve([value]);
          }
          try {
            return resolve(onfulfilled([value]));
          } catch (err) {
            return reject(err);
          }
        },
        onErr: (err: unknown) => {
          if (!onrejected) {
            return reject(err);
          }
          try {
            resolve(onrejected(err));
          } catch (error) {
            reject(error);
          }
        },
      };
      this.#handlers.push(handlers);
      this.#executeHandlers();
    });
  }

  public finally(callback: () => void) {
    return new Promise2<TSuccess, TFail>((success, fail, error) => {
      let val: TSuccess | TFail;
      let isFailed: boolean;
      let thrown: unknown;

      this.catch((err) => (thrown = err))
        .then(
          (value) => {
            isFailed = false;
            val = value as TSuccess;
            return callback();
          },
          (err) => {
            isFailed = true;
            val = err as TFail;
            return callback();
          }
        )
        .then(() => {
          if (thrown) {
            return error(thrown);
          }
          if (isFailed) {
            return fail(val as TFail);
          }
          return success(val as TSuccess);
        });
    });
  }
}

function isPromise2<TVal, TErr>(
  maybePromise: TVal | TErr | Promise2<TVal, TErr> | unknown
): maybePromise is Promise2<TVal, TErr> {
  return typeof (maybePromise as Promise2<TVal, TErr>)?.next === 'function';
}

function isPromiseLike<T>(maybePromise: PromiseLike<T> | unknown): maybePromise is PromiseLike<T> {
  return typeof (maybePromise as PromiseLike<T>)?.then === 'function';
}
