enum State {
    PENDING,
    SUCCESS,
    FAIL,
    ERROR,
}

type Handlers = {
    onSuccess?: (val: any) => any,
    onFail?: (err: any) => any,
    onErr?: (err: any) => any
}

type Unwind<T> = T extends Promise2<infer S, infer F> ? S | F : T;

type RSuccess<T> = [T] extends [never] ? Promise2<never, never> : T extends Promise2<infer S, infer F> ? Promise2<S, F> : Promise2<T, never>;

type RFail<T> = [T] extends [never] ? Promise2<never, never> : T extends Promise2<infer S, infer F> ? Promise2<S, F> : Promise2<never, T>;

type RBoth<TS, TF> = Promise2<Unwind<TS>, Unwind<TF>>

type PParam<TSuccess, TFail> = [TSuccess] extends [never] ? [TFail] extends [never] ? never : [TFail] : [null, TSuccess] 

class Promise2<TSuccess = unknown, TFail = unknown> {
    static success<T>(value: T) {
        return new Promise2<T, never>((success) => success(value))
    }
    static fail<T>(value: T) {
        return new Promise2<never, T>((_, fail) => fail(value))
    }
    static error(err: any) {
        return new Promise2<never, never>((_s, _f, error) => error(err))
    }

    static all = Promise.all;
    static race = Promise.race;
    static allSettled = Promise.allSettled;
    static resolve = Promise.resolve;
    static reject = Promise.reject;
    static [Symbol.species] = Promise2

    #val?: TSuccess | TFail | any;
    #state: State = State.PENDING;
    #handlers: Handlers[] = [];

    #success = (value: TSuccess) => {
        this.#updateResult(value, State.SUCCESS);
    }
    #fail = (value: TFail) => {
        this.#updateResult(value, State.FAIL);
    }
    #error = (err: any) => {
        this.#updateResult(err, State.ERROR);
    }
    #defaultErrorHandler(err: any) { throw err }

    constructor(executable: (success: (val: TSuccess) => void, fail: (val: TFail) => void, err: (err: any) => void) => void) {
        executable(this.#success, this.#fail, this.#error)
    }

    
    #updateResult(val: TSuccess | TFail | any, state: State) {    
        if (this.#state !== State.PENDING) {
            return;
        } 

        if (isPromise2(val)) {
            return val.next(this.#success, this.#fail, this.#error)
        }

        this.#val = val;
        this.#state = state;

        this.#executeHandlers()
    }

    #executeHandlers() {
        if (this.#state === State.PENDING) {
            return null;
        }
        if (this.#state === State.ERROR && this.#handlers.length === 0) {
            return this.#defaultErrorHandler(this.#val);
        }
        this.#handlers.forEach(handlers => {
            const onErr = handlers.onErr ?? this.#defaultErrorHandler;
            if (this.#state === State.SUCCESS) {
                return queueMicrotask(() => {
                    try {
                        return handlers.onSuccess!(this.#val);
                    } catch (error) {
                        return onErr(error);
                    }
                })
            }
            if (this.#state === State.FAIL) {
                return queueMicrotask(() => {
                    try {
                        return handlers.onFail!(this.#val);
                    } catch (error) {
                        return onErr(error);
                    }
                })
            }
            return queueMicrotask(() => onErr(this.#val));
        })
        this.#handlers = [];
    }

    next<TRes1, TRes2, TRes3>(onSuccess?: (val: TSuccess) => TRes1, onFail?: (val: TFail) => TRes2, onErr?: (err: any) => TRes3) {
        return new Promise2((success, fail, error) => {
            const handlers = {
                onSuccess: (value: TSuccess) => { 
                    if (!onSuccess) {
                        return success(value);
                    }
                    try {
                        return success(onSuccess(value));
                    } catch (err) {
                        return error(err)
                    }
                 },
                 onFail: (value: TFail) => {
                    if (!onFail) {
                        return fail(value);
                    }
                    try {
                        return fail(onFail(value));
                    } catch (err) {
                        return error(err)
                    }
                },
                onErr: (err: any) => { 
                    if (!onErr) {
                        return error(err);
                    }
                    try {
                        return success(onErr(err))
                    } catch (err) { 
                        return error(err)
                    }
                   
                 }
            }
            this.#handlers.push(handlers);
            this.#executeHandlers();
        });
    }

    success<TRes>(onSuccess: (val: TSuccess) => TRes): RSuccess<TRes>
    success<TRes>(onSuccess: (val: TSuccess) => TRes, onErr?: (err: any) => any) {
        return this.next(onSuccess, undefined, onErr);
    } 

    fail<TRes>(onFail: (val: TFail) => TRes): RFail<TRes>
    fail<TRes>(onFail: (val: TFail) => TRes, onErr?: (err: any) => any) {
        return this.next(undefined, onFail, onErr);
    }

    catch<TRes>(onErr: (err: any) => TRes) {
        return this.next(undefined, undefined, onErr);
    }

    then(): Promise<TSuccess | TFail>
    then<TRes>(onResolve: (val: PParam<TSuccess, TFail>) => TRes): Promise<TRes | PParam<never, TFail>>
    then<TRes>(onResolve: undefined, onReject: (err: any) => TRes): Promise<PParam<TSuccess, never> | TRes>
    then<TRes1, TRes2>(onResolve: (val: PParam<TSuccess, TFail>) => TRes1, onReject: (err: any) => TRes2): Promise<TRes1 | TRes2>
    
    then<TRes1, TRes2>(onResolve?: (val: any) => TRes1, onReject?: (err: any) => TRes2 | never) {
        return new Promise((res, rej) => {
            const handlers = {
                onSuccess: (value: TSuccess) => { 
                    if (!onResolve) {
                        return res([null, value]);
                    }
                    try {
                        return res(onResolve([null, value]));
                    } catch (err) {
                        if (onReject) {
                            return rej(onReject(err))
                        }
                        return rej(err)
                    }
                 },
                onFail: (value: TFail) => {
                    if (!onResolve) {
                        return res([null, value])
                    }
                    
                    try {
                        return res(onResolve([value]));
                    } catch (err) {
                        if (onReject) {
                            return rej(onReject(err))
                        }
                        return rej(err)
                    }
                },
                onErr: (err: any) => rej(this.#defaultErrorHandler(err)),
            }
            this.#handlers.push(handlers);
            this.#executeHandlers();
        })
    }

    finally(callback: () => any) {
        return new Promise2<TSuccess, TFail>((success, fail, error) => {
           let val: TSuccess | TFail;
           let isFailed: boolean;
           let thrown: any;
           
           this
            .catch((err) => thrown = err)
            .then((value) => {
                isFailed = false;
                val = value as TSuccess;
                return callback();
            }, (err) => {
                isFailed = true;
                val = err as TFail;
                return callback();
            }).then(() => {
                if(thrown) {
                    return error(thrown);
                } 
                if (isFailed) {
                    return fail(val as TFail);
                }
                return success(val as TSuccess);
            })
        })
      }
}

function isPromise2<TVal, TErr>(maybePromise: TVal | TErr | Promise2<TVal, TErr>): maybePromise is Promise2<TVal, TErr> { 
    return typeof (maybePromise as Promise2<TVal, TErr>)?.then === 'function'
}




// global.Promise = Promise2;


// interface Promise<T> extends Omit<Promise2<T, any>, 'toPromise'> {}

// const pr = new Promise2(r => { r(2); r(3)})
// pr.then(val => console.log(val))
// pr.then(val => console.log('SECOND', val))

const a = new Promise2((resolve) => {
    setTimeout(() => resolve('pidor'), 1200)
})
const chain = a
    .success(val => { console.log(val); return new Promise2<string, never>((res) => setTimeout(() => res('sex on the bitch: ' + val), 2000)) })
    .success(console.log)
    .success(() => { console.log('TUTTA'); return Promise2.fail('sex') })
    .fail(val => { console.log('FAILED:', val); throw new Error('chmo from failed') })
    .catch((err: any) => { console.log('CAUGHT', err.message); return Promise2.fail(1) })
    .success(() => {})
    .fail(val => { console.log('AFTER CATCH', val)})
    .success(() => Promise2.fail(3))
    .fail(() => 4)
    .fail((val) => val + 5)
    .success((val) => {console.log('1', val)})
    .fail((val) => { console.log(2, val); return Promise2.fail('sexd') })
    .fail((val) => { console.log('CALLED LAST'); return val + 12 });
Promise2.fail(3).fail(() =>  {throw new Error('4') }).catch(console.error)