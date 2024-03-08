import Promise2 from '../src';

jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
describe('Promise2 test', () => {
  it('creates promise like object', async () => {
    expect.assertions(3);
    const pr = new Promise2<void, never>((success) => success());

    expect(pr).toHaveProperty('then');
    expect(pr.then).toBeInstanceOf(Function);
    await expect(pr).resolves.toMatchObject(expect.anything());
  });

  it('should call only first callback', async () => {
    expect.assertions(2);
    const pr = new Promise2((success, fail, err) => {
      success('success');
      fail('fail');
      err('err');
    });
    const fn = jest.fn();

    await pr.next(fn, fn, fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('success');
  });

  it('can be awaited', async () => {
    expect.assertions(1);
    const pr = new Promise2((success) => setTimeout(success, 1000, 'success'));
    jest.runAllTimers();
    const res = await pr;
    expect(res).toMatchObject([null, 'success']);
  });

  describe('STATIC METHODS', () => {
    const successFn = jest.fn();
    const failFn = jest.fn();
    const errorFn = jest.fn();

    beforeEach(() => jest.clearAllMocks());

    it('should create succeeded promise', async () => {
      expect.assertions(4);
      await Promise2.success('success').next(successFn, failFn, errorFn);

      expect(successFn).toHaveBeenCalledTimes(1);
      expect(successFn).toHaveBeenCalledWith('success');
      expect(failFn).toHaveBeenCalledTimes(0);
      expect(errorFn).toHaveBeenCalledTimes(0);
    });
    it('should create failed promise', async () => {
      expect.assertions(4);
      await Promise2.fail('fail').next(successFn, failFn, errorFn);

      expect(failFn).toHaveBeenCalledTimes(1);
      expect(failFn).toHaveBeenCalledWith('fail');
      expect(successFn).toHaveBeenCalledTimes(0);
      expect(errorFn).toHaveBeenCalledTimes(0);
    });
    it('should create error promise', async () => {
      expect.assertions(4);
      await Promise2.error('error').next(successFn, failFn, errorFn);

      expect(errorFn).toHaveBeenCalledTimes(1);
      expect(errorFn).toHaveBeenCalledWith('error');
      expect(failFn).toHaveBeenCalledTimes(0);
      expect(successFn).toHaveBeenCalledTimes(0);
    });
  });

  describe('TIMINGS', () => {
    it('should call executor synchronously', () => {
      expect.assertions(1);
      const fn = jest.fn();
      new Promise2(fn);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should call handlers attached after values is resolved', async () => {
      expect.assertions(3);
      const executorFn = jest.fn((success) => success());
      const handlerFn = jest.fn();
      const pr = new Promise2(executorFn);
      expect(executorFn).toHaveBeenCalledTimes(1);
      expect(handlerFn).toHaveBeenCalledTimes(0);
      await pr.next(handlerFn);
      expect(handlerFn).toHaveBeenCalledTimes(1);
    });

    it('should call handlers attached before values is resolved', async () => {
      expect.assertions(4);
      const resolverFn = jest.fn((success) => success());
      const handlerFn = jest.fn();
      const pr = new Promise2((success) => setTimeout(() => resolverFn(success), 10000));
      pr.next(handlerFn);

      expect(resolverFn).toHaveBeenCalledTimes(0);
      expect(handlerFn).toHaveBeenCalledTimes(0);
      jest.runAllTimers();
      expect(resolverFn).toHaveBeenCalledTimes(1);
      await pr;
      expect(handlerFn).toHaveBeenCalledTimes(1);
    });

    it('should call next callbacks in microtask', async () => {
      expect.assertions(2);
      const pr = new Promise2((success) => success('value'));
      const fn = jest.fn();
      pr.next(fn);

      expect(fn).toHaveBeenCalledTimes(0);
      await new Promise(process.nextTick);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should call sequential handlers in one event loop's phase", async () => {
      expect.assertions(2);
      const pr = new Promise2((success) => success('value'));
      const fn = jest.fn();
      pr.next(fn).next(fn).next(fn);

      expect(fn).toHaveBeenCalledTimes(0);
      await new Promise(process.nextTick);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should resolve right after callback is called', async () => {
      expect.assertions(4);
      const pr = new Promise2((success) => setTimeout(() => success('success'), 10000));
      const fn = jest.fn();
      pr.next(fn);

      expect(fn).toHaveBeenCalledTimes(0);
      jest.advanceTimersByTime(9000);
      expect(fn).toHaveBeenCalledTimes(0);
      jest.runAllTimers();
      const res = await Promise.race([pr, new Promise(process.nextTick)]);
      expect(res).toMatchObject([null, 'success']);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should add tasks to microqueue in order of calls', async () => {
      expect.assertions(1);
      const pr = Promise2.success('value').then((val) => val);
      const original = Promise.resolve('origValue').then((val) => val);

      const res = await Promise.race([pr, original]);
      expect(res).toMatchObject([null, 'value']);
    });
  });

  describe('STATE HANDLING', () => {
    it('should call only success handlers on success', async () => {
      expect.assertions(3);
      const pr = new Promise2<string, never>((success) => success('success'));
      const shouldBeCalled = jest.fn((val) => val);
      const shouldNotBeCalled = jest.fn((val) => val);

      await pr
        .success(shouldBeCalled)
        .fail(shouldNotBeCalled)
        .success(shouldBeCalled)
        .catch(shouldNotBeCalled)
        .success(shouldBeCalled);

      expect(shouldNotBeCalled).toHaveBeenCalledTimes(0);
      expect(shouldBeCalled).toHaveBeenCalledTimes(3);
      expect(shouldBeCalled).toHaveBeenCalledWith('success');
    });
    it('should call only fail handlers on fail', async () => {
      expect.assertions(3);
      const pr = new Promise2<never, string>((_, fail) => fail('fail'));
      const shouldBeCalled = jest.fn((val) => val);
      const shouldNotBeCalled = jest.fn((val) => val);

      await pr
        .fail(shouldBeCalled)
        .success(shouldNotBeCalled)
        .fail(shouldBeCalled)
        .catch(shouldNotBeCalled)
        .fail(shouldBeCalled);

      expect(shouldNotBeCalled).toHaveBeenCalledTimes(0);
      expect(shouldBeCalled).toHaveBeenCalledTimes(3);
      expect(shouldBeCalled).toHaveBeenCalledWith('fail');
    });
    it('should call catch handlers on error', async () => {
      expect.assertions(3);
      const pr = new Promise2<never, string>((success, fail, err) => err('error'));
      const shouldBeCalled = jest.fn((val) => val);
      const shouldNotBeCalled = jest.fn((val) => val);

      await pr.success(shouldNotBeCalled).fail(shouldNotBeCalled).catch(shouldBeCalled);

      expect(shouldNotBeCalled).toHaveBeenCalledTimes(0);
      expect(shouldBeCalled).toHaveBeenCalledTimes(1);
      expect(shouldBeCalled).toHaveBeenCalledWith('error');
    });
    it('should switch state to success on error caught', async () => {
      expect.assertions(3);
      const pr = new Promise2<never, string>((success, fail, err) => err('error'));
      const shouldBeCalled = jest.fn((val) => val);
      const shouldNotBeCalled = jest.fn((val) => val);

      await pr
        .success(shouldNotBeCalled)
        .fail(shouldNotBeCalled)
        .catch(shouldBeCalled)
        .fail(shouldNotBeCalled)
        .catch(shouldNotBeCalled)
        .success(shouldBeCalled);

      expect(shouldNotBeCalled).toHaveBeenCalledTimes(0);
      expect(shouldBeCalled).toHaveBeenCalledTimes(2);
      expect(shouldBeCalled).toHaveBeenCalledWith('error');
    });
    it('should properly switch state based on handler return value', async () => {
      expect.assertions(4);
      const pr = new Promise2<never, string>((_, fail) => fail('fail'));
      const toSuccess = jest.fn(() => Promise2.success('switched to success'));
      const toFail = jest.fn(() => Promise2.fail('switched to fail'));
      const toError = jest.fn(() => Promise2.error('switched to error'));
      const finish = jest.fn();

      await pr.fail(toSuccess).success(toError).catch(toFail).fail(finish);

      expect(toSuccess).toHaveBeenCalledWith('fail');
      expect(toError).toHaveBeenCalledWith('switched to success');
      expect(toFail).toHaveBeenCalledWith('switched to error');
      expect(finish).toHaveBeenCalledWith('switched to fail');
    });
  });
});
