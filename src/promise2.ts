type Handlers<TS = unknown, TF = unknown> = {
  onSuccess: (value: TS) => void;
  onFail: (value: TF) => void;
  onErr: (err: unknown) => void;
};

type Unwind<T> = T extends Promise2<infer S, infer F> ? Promise2<S, F> : T;

type Handler<T, R> = (val: T) => R extends Promise2<infer S, infer F> ? Promise2<S, F> : R;

type ParamTuple<Ok, Fail> = [null, Ok] | [Fail];

enum State {
  PENDING,
  SUCCESS,
  FAIL,
  ERROR,
}

function isPromise2<T, Ok, Fail>(maybePromise: T | Promise2<Ok, Fail>): maybePromise is Promise2<Ok, Fail> {
  return typeof (maybePromise as Promise2<Ok, Fail>)?.next === 'function';
}

function isPromiseLike<T>(maybePromise: PromiseLike<T> | unknown): maybePromise is PromiseLike<T> {
  return typeof (maybePromise as PromiseLike<T>)?.then === 'function';
}

export default class Promise2<Ok, Fail> implements PromiseLike<ParamTuple<Ok, Fail>> {
  static succeed(value: unknown) {
    if (isPromise2(value)) {
      return value;
    }

    return new Promise2((success) => success(value));
  }

  static fail(value: unknown) {
    if (isPromise2(value)) {
      return value;
    }

    return new Promise2((_, fail) => fail(value));
  }

  static throw(err: unknown) {
    return new Promise2((_s, _f, error) => error(err));
  }

  static fromPromise(pr: PromiseLike<unknown>, rejectToFail = false) {
    return new Promise2((success, fail, err) => {
      pr.then(success, rejectToFail ? fail : err);
    });
  }

  static all = Promise.all;
  static race = Promise.race;
  static allSettled = Promise.allSettled;
  static resolve = Promise.resolve;
  static reject = Promise.reject;
  static [Symbol.species] = this;

  #val?: Ok | Fail | unknown;
  #state = State.PENDING;
  #handlers: Handlers<Ok, Fail>[] = [];
  #handlersExecuted = false;

  #success = (value: Ok | unknown) => {
    this.#updateResult(value, State.SUCCESS);
  };
  #fail = (value: Fail | unknown) => {
    this.#updateResult(value, State.FAIL);
  };
  #error = (err: unknown) => {
    this.#updateResult(err, State.ERROR);
  };

  #defaultErrorHandler(err: unknown) {
    // emit 'unhandledRejection'
    Promise.reject(err);
  }

  constructor(
    executable: (success: (val: Ok) => void, fail: (val: Fail) => void, err: (err: unknown) => void) => void
  ) {
    executable(this.#success, this.#fail, this.#error);
  }

  #updateResult(val: Ok | Fail | unknown, state: State) {
    if (this.#state !== State.PENDING) {
      return;
    }
    if (isPromise2(val)) {
      return val.next(this.#success, this.#fail, this.#error);
    }

    if (isPromiseLike<Ok>(val)) {
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
          return handlers.onSuccess(this.#val as Ok);
        }
        if (this.#state === State.FAIL) {
          return handlers.onFail(this.#val as Fail);
        }
        return onErr(this.#val);
      });
      this.#handlers = [];
      this.#handlersExecuted = true;
    });
  }

  public next<TRes1, TRes2, TRes3>(
    onSuccess?: Handler<Ok, TRes1>,
    onFail?: Handler<Fail, TRes2>,
    onErr?: Handler<unknown, TRes3>
  ) {
    return new Promise2<Ok | Unwind<TRes1> | Unwind<TRes3>, Fail | Unwind<TRes2>>((success, fail, error) => {
      const handlers = {
        onSuccess: (value: Ok) => {
          if (!onSuccess) {
            return success(value);
          }
          try {
            return success(onSuccess(value));
          } catch (err) {
            return error(err);
          }
        },
        onFail: (value: Fail) => {
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

  public success<TRes1, TRes2>(onSuccess: Handler<Ok, TRes1>, onErr?: Handler<unknown, TRes2>) {
    return this.next(onSuccess, undefined, onErr);
  }

  public fail<TRes1, TRes2>(onFail: Handler<Fail, TRes1>, onErr?: Handler<unknown, TRes2>) {
    return this.next(undefined, onFail, onErr);
  }

  public catch<TRes>(onErr: Handler<unknown, TRes>) {
    return this.next(undefined, undefined, onErr);
  }

  then<TResult1 = ParamTuple<Ok, Fail>, TResult2 = never>(
    onfulfilled?: ((value: ParamTuple<Ok, Fail>) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): PromiseLike<TResult1 | TResult2>;
  public then(onfulfilled?: (val: ParamTuple<Ok, Fail>) => unknown, onrejected?: (err: unknown) => unknown) {
    return new Promise((resolve, reject) => {
      const handlers = {
        onSuccess: (value: Ok) => {
          if (!onfulfilled) {
            return resolve([null, value]);
          }
          try {
            return resolve(onfulfilled([null, value]));
          } catch (err) {
            return reject(err);
          }
        },
        onFail: (value: Fail) => {
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
    return new Promise2<Ok, Fail>((success, fail, error) => {
      let val: Ok | Fail;
      let isFailed: boolean;
      let thrown: unknown;

      this.catch((err) => (thrown = err))
        .then(
          (value) => {
            isFailed = false;
            val = value as Ok;
            return callback();
          },
          (err) => {
            isFailed = true;
            val = err as Fail;
            return callback();
          }
        )
        .then(() => {
          if (thrown) {
            return error(thrown);
          }
          if (isFailed) {
            return fail(val as Fail);
          }
          return success(val as Ok);
        });
    });
  }
}
