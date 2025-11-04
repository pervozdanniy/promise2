import Promise2 from '../src';

jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });

describe('Promise2.fail()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic failure handling', () => {
    it('should call fail handler when promise fails', async () => {
      const failHandler = jest.fn();
      const errorHandler = jest.fn();

      const pr = Promise2.fail('failure')
        .fail(failHandler, errorHandler);

      expect(failHandler).toHaveBeenCalledTimes(0);
      expect(errorHandler).toHaveBeenCalledTimes(0);

      await pr;

      expect(failHandler).toHaveBeenCalledWith('failure');
      expect(errorHandler).toHaveBeenCalledTimes(0);
    });

    it('should call fail handler when promise fails with delay', async () => {
      const failHandler = jest.fn();
      const errorHandler = jest.fn();

      const pr = new Promise2((_, fail) => {
        setTimeout(() => fail('delayed failure'), 1000);
      })
        .fail(failHandler, errorHandler);

      expect(failHandler).toHaveBeenCalledTimes(0);
      expect(errorHandler).toHaveBeenCalledTimes(0);

      jest.runAllTimers();
      await pr;

      expect(failHandler).toHaveBeenCalledWith('delayed failure');
      expect(errorHandler).toHaveBeenCalledTimes(0);
    });

    it('should not call fail handler when promise succeeds', async () => {
      const failHandler = jest.fn();
      const errorHandler = jest.fn();

      const pr = Promise2.succeed('success')
        .fail(failHandler, errorHandler);

      await pr;

      expect(failHandler).toHaveBeenCalledTimes(0);
      expect(errorHandler).toHaveBeenCalledTimes(0);
    });

    it('should call error handler when promise throws', async () => {
      const failHandler = jest.fn();
      const errorHandler = jest.fn();

      const pr = Promise2.throw('error')
        .fail(failHandler, errorHandler);

      await pr;

      expect(failHandler).toHaveBeenCalledTimes(0);
      expect(errorHandler).toHaveBeenCalledWith('error');
    });
  });

  describe('Fail handler return values', () => {
    it('should handle fail handler returning a value', async () => {
      const failHandler = jest.fn(() => Promise2.succeed('recovery value'));
      const resultHandler = jest.fn();

      const pr = Promise2.fail('original failure')
        .fail(failHandler)
        .success(resultHandler);

      await pr;

      expect(failHandler).toHaveBeenCalledWith('original failure');
      expect(resultHandler).toHaveBeenCalledWith('recovery value');
    });

    it('should handle fail handler returning a Promise2', async () => {
      const failHandler = jest.fn(() => Promise2.succeed('recovery promise'));
      const resultHandler = jest.fn();

      const pr = Promise2.fail('original failure')
        .fail(failHandler)
        .success(resultHandler);

      await pr;

      expect(failHandler).toHaveBeenCalledWith('original failure');
      expect(resultHandler).toHaveBeenCalledWith('recovery promise');
    });

    it('should handle fail handler throwing', async () => {
      const failHandler = jest.fn(() => {
        throw new Error('fail handler error');
      });
      const errorHandler = jest.fn();

      const pr = Promise2.fail('original failure')
        .fail(failHandler)
        .catch(errorHandler);

      await pr;

      expect(failHandler).toHaveBeenCalledWith('original failure');
      expect(errorHandler).toHaveBeenCalledWith(new Error('fail handler error'));
    });
  });

  describe('Error handler behavior', () => {
    it('should handle error handler returning a value', async () => {
      const failHandler = jest.fn();
      const errorHandler = jest.fn(() => Promise2.succeed('error recovery'));
      const resultHandler = jest.fn();

      const pr = Promise2.throw('error')
        .fail(failHandler, errorHandler)
        .success(resultHandler);

      await pr;

      expect(failHandler).toHaveBeenCalledTimes(0);
      expect(errorHandler).toHaveBeenCalledWith('error');
      expect(resultHandler).toHaveBeenCalledWith('error recovery');
    });

    it('should handle error handler returning a Promise2', async () => {
      const failHandler = jest.fn();
      const errorHandler = jest.fn(() => Promise2.succeed('recovery'));
      const resultHandler = jest.fn();

      const pr = Promise2.throw('error')
        .fail(failHandler, errorHandler)
        .success(resultHandler);

      await pr;

      expect(failHandler).toHaveBeenCalledTimes(0);
      expect(errorHandler).toHaveBeenCalledWith('error');
      expect(resultHandler).toHaveBeenCalledWith('recovery');
    });

    it('should handle error handler throwing', async () => {
      const failHandler = jest.fn();
      const errorHandler = jest.fn(() => {
        throw new Error('error handler error');
      });
      const finalErrorHandler = jest.fn();

      const pr = Promise2.throw('original error')
        .fail(failHandler, errorHandler)
        .catch(finalErrorHandler);

      await pr;

      expect(failHandler).toHaveBeenCalledTimes(0);
      expect(errorHandler).toHaveBeenCalledWith('original error');
      expect(finalErrorHandler).toHaveBeenCalledWith(new Error('error handler error'));
    });
  });

  describe('Chaining', () => {
    it('should chain multiple fail calls', async () => {
      const handler1 = jest.fn((val) => val + '1');
      const handler2 = jest.fn((val) => val + '2');
      const handler3 = jest.fn((val) => val + '3');
      const finalHandler = jest.fn();

      const pr = Promise2.fail('start')
        .fail(handler1)
        .fail(handler2)
        .fail(handler3)
        .fail(finalHandler);

      await pr;

      expect(handler1).toHaveBeenCalledWith('start');
      expect(handler2).toHaveBeenCalledWith('start1');
      expect(handler3).toHaveBeenCalledWith('start12');
      expect(finalHandler).toHaveBeenCalledWith('start123');
    });

    it('should work with other Promise2 methods', async () => {
      const successHandler = jest.fn();
      const failHandler = jest.fn((val) => val.toUpperCase());
      const errorHandler = jest.fn();

      const pr = Promise2.fail('hello')
        .success(successHandler)
        .fail(failHandler)
        .catch(errorHandler);

      await pr;

      expect(successHandler).toHaveBeenCalledTimes(0);
      expect(failHandler).toHaveBeenCalledWith('hello');
      expect(errorHandler).toHaveBeenCalledTimes(0);
    });
  });

  describe('State transitions', () => {
    it('should handle fail after success state change', async () => {
      const failHandler = jest.fn();

      const pr = Promise2.succeed('start')
        .next(() => Promise2.fail('changed'))
        .fail(failHandler);

      await pr;

      expect(failHandler).toHaveBeenCalledWith('changed');
    });

    it('should handle fail after error state change', async () => {
      const failHandler = jest.fn();
      const errorHandler = jest.fn(() => Promise2.fail('error to fail'));

      const pr = Promise2.throw('error')
        .catch(errorHandler)
        .fail(failHandler);

      await pr;

      expect(failHandler).toHaveBeenCalledWith('error to fail');
    });
  });
}); 