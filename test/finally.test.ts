import Promise2 from '../src';

jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });

describe('Promise2.finally()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Success cases', () => {
    it('should call finally callback when promise succeeds', async () => {
      const finallyCallback = jest.fn();
      const successHandler = jest.fn();

      const pr = Promise2.succeed('success')
        .finally(finallyCallback)
        .next(successHandler);

      expect(finallyCallback).toHaveBeenCalledTimes(0);
      expect(successHandler).toHaveBeenCalledTimes(0);

      await pr;

      expect(finallyCallback).toHaveBeenCalledTimes(1);
      expect(successHandler).toHaveBeenCalledWith('success');
    });

    it('should call finally callback when promise succeeds with delay', async () => {
      const finallyCallback = jest.fn();
      const successHandler = jest.fn();

      const pr = new Promise2((success) => {
        setTimeout(() => success('delayed success'), 1000);
      })
        .finally(finallyCallback)
        .next(successHandler);

      expect(finallyCallback).toHaveBeenCalledTimes(0);
      expect(successHandler).toHaveBeenCalledTimes(0);

      jest.runAllTimers();
      await pr;

      expect(finallyCallback).toHaveBeenCalledTimes(1);
      expect(successHandler).toHaveBeenCalledWith('delayed success');
    });

    it('should preserve success value after finally', async () => {
      const finallyCallback = jest.fn();
      const successHandler = jest.fn();

      const pr = Promise2.succeed('original value')
        .finally(finallyCallback)
        .next(successHandler);

      await pr;

      expect(successHandler).toHaveBeenCalledWith('original value');
    });
  });

  describe('Failure cases', () => {
    it('should call finally callback when promise fails', async () => {
      const finallyCallback = jest.fn();
      const failHandler = jest.fn();

      const pr = Promise2.fail('failure')
        .finally(finallyCallback)
        .next(undefined, failHandler);

      expect(finallyCallback).toHaveBeenCalledTimes(0);
      expect(failHandler).toHaveBeenCalledTimes(0);

      await pr;

      expect(finallyCallback).toHaveBeenCalledTimes(1);
      expect(failHandler).toHaveBeenCalledWith('failure');
    });

    it('should call finally callback when promise fails with delay', async () => {
      const finallyCallback = jest.fn();
      const failHandler = jest.fn();

      const pr = new Promise2((_, fail) => {
        setTimeout(() => fail('delayed failure'), 1000);
      })
        .finally(finallyCallback)
        .next(undefined, failHandler);

      expect(finallyCallback).toHaveBeenCalledTimes(0);
      expect(failHandler).toHaveBeenCalledTimes(0);

      jest.runAllTimers();
      await pr;

      expect(finallyCallback).toHaveBeenCalledTimes(1);
      expect(failHandler).toHaveBeenCalledWith('delayed failure');
    });

    it('should preserve failure value after finally', async () => {
      const finallyCallback = jest.fn();
      const failHandler = jest.fn();

      const pr = Promise2.fail('original failure')
        .finally(finallyCallback)
        .next(undefined, failHandler);

      await pr;

      expect(failHandler).toHaveBeenCalledWith('original failure');
    });
  });

  describe('Error cases', () => {
    it('should call finally callback when promise throws', async () => {
      const finallyCallback = jest.fn();
      const errorHandler = jest.fn();

      const pr = Promise2.throw('error')
        .finally(finallyCallback)
        .catch(errorHandler);

      expect(finallyCallback).toHaveBeenCalledTimes(0);
      expect(errorHandler).toHaveBeenCalledTimes(0);

      await pr;

      expect(finallyCallback).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith('error');
    });

    it('should call finally callback when promise throws with delay', async () => {
      const finallyCallback = jest.fn();
      const errorHandler = jest.fn();

      const pr = new Promise2((_, __, error) => {
        setTimeout(() => error('delayed error'), 1000);
      })
        .finally(finallyCallback)
        .catch(errorHandler);

      expect(finallyCallback).toHaveBeenCalledTimes(0);
      expect(errorHandler).toHaveBeenCalledTimes(0);

      jest.runAllTimers();
      await pr;

      expect(finallyCallback).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith('delayed error');
    });

    it('should preserve error value after finally', async () => {
      const finallyCallback = jest.fn();
      const errorHandler = jest.fn();

      const pr = Promise2.throw('original error')
        .finally(finallyCallback)
        .catch(errorHandler);

      await pr;

      expect(errorHandler).toHaveBeenCalledWith('original error');
    });
  });

  describe('Finally callback behavior', () => {
    it('should call finally callback without parameters', async () => {
      const finallyCallback = jest.fn();

      const pr = Promise2.succeed('value').finally(finallyCallback);

      await pr;

      expect(finallyCallback).toHaveBeenCalledWith();
    });

    it('should call finally callback that returns a value', async () => {
      const finallyCallback = jest.fn(() => 'returned value');
      const successHandler = jest.fn();

      const pr = Promise2.succeed('original')
        .finally(finallyCallback)
        .next(successHandler);

      await pr;

      expect(finallyCallback).toHaveBeenCalledTimes(1);
      expect(successHandler).toHaveBeenCalledWith('original');
    });

    it('should call finally callback that returns a Promise2', async () => {
      const finallyCallback = jest.fn(() => Promise2.succeed('finally promise'));
      const successHandler = jest.fn();

      const pr = Promise2.succeed('original')
        .finally(finallyCallback)
        .next(successHandler);

      await pr;

      expect(finallyCallback).toHaveBeenCalledTimes(1);
      expect(successHandler).toHaveBeenCalledWith('original');
    });

    it('should handle finally callback that throws synchronously', async () => {
      const finallyCallback = jest.fn(() => {
        throw new Error('finally error');
      });
      const errorHandler = jest.fn();

      const pr = Promise2.succeed('value')
        .finally(finallyCallback)
        .catch(errorHandler);

      await pr;

      expect(finallyCallback).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(new Error('finally error'));
    });

    it.failing('should handle finally callback that throws asynchronously', async () => {
      const finallyCallback = jest.fn(() => {
        return new Promise2((_, __, error) => {
          setTimeout(() => {
            error(new Error('async finally error'));
          }, 1000);
        });
      });
      const errorHandler = jest.fn();

      const pr = Promise2.succeed('value')
        .finally(finallyCallback)
        .catch(errorHandler);

      jest.runAllTimers();
      await pr;

      expect(finallyCallback).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(new Error('async finally error'));
    });
  });

  describe('Chaining finally', () => {
    it('should chain multiple finally callbacks', async () => {
      const finally1 = jest.fn();
      const finally2 = jest.fn();
      const finally3 = jest.fn();
      const successHandler = jest.fn();

      const pr = Promise2.succeed('value')
        .finally(finally1)
        .finally(finally2)
        .finally(finally3)
        .next(successHandler);

      await pr;

      expect(finally1).toHaveBeenCalledTimes(1);
      expect(finally2).toHaveBeenCalledTimes(1);
      expect(finally3).toHaveBeenCalledTimes(1);
      expect(successHandler).toHaveBeenCalledWith('value');
    });

    it('should chain finally with other methods', async () => {
      const finallyCallback = jest.fn();
      const successHandler = jest.fn();
      const failHandler = jest.fn();
      const errorHandler = jest.fn();

      const pr = Promise2.succeed('value')
        .next(successHandler)
        .finally(finallyCallback)
        .next(successHandler)
        .fail(failHandler)
        .finally(finallyCallback)
        .catch(errorHandler);

      await pr;

      expect(finallyCallback).toHaveBeenCalledTimes(2);
      expect(successHandler).toHaveBeenCalledTimes(2);
      expect(failHandler).toHaveBeenCalledTimes(0);
      expect(errorHandler).toHaveBeenCalledTimes(0);
    });

    it('should handle finally after state changes', async () => {
      const finallyCallback = jest.fn();
      const failHandler = jest.fn();

      const pr = Promise2.succeed('start')
        .next(() => Promise2.fail('changed'))
        .finally(finallyCallback)
        .next(undefined, failHandler);

      await pr;

      expect(finallyCallback).toHaveBeenCalledTimes(1);
      expect(failHandler).toHaveBeenCalledWith('changed');
    });
  });

  describe('Edge cases', () => {
    it('should handle finally on already resolved promise', async () => {
      const finallyCallback = jest.fn();
      const successHandler = jest.fn();

      const pr = Promise2.succeed('value');
      
      // Wait for resolution
      await pr;
      
      // Add finally after resolution
      const chained = pr.finally(finallyCallback).next(successHandler);

      await chained;

      expect(finallyCallback).toHaveBeenCalledTimes(1);
      expect(successHandler).toHaveBeenCalledWith('value');
    });

    it('should handle finally on already failed promise', async () => {
      const finallyCallback = jest.fn();
      const failHandler = jest.fn();

      const pr = Promise2.fail('failure');
      
      // Wait for resolution
      await pr;
      
      // Add finally after resolution
      const chained = pr.finally(finallyCallback).next(undefined, failHandler);

      await chained;

      expect(finallyCallback).toHaveBeenCalledTimes(1);
      expect(failHandler).toHaveBeenCalledWith('failure');
    });

    it('should handle finally on already errored promise', async () => {
      const finallyCallback = jest.fn();

      const pr = Promise2.throw('error').catch(() => {});
      
      // Wait for resolution
      await pr;
      
      // Add finally after resolution
      const chained = pr.finally(finallyCallback);

      await chained;

      expect(finallyCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle finally callback that returns a failing Promise2', async () => {
      const finallyCallback = jest.fn(() => Promise2.fail('finally failure'));
      const errorHandler = jest.fn();

      const pr = Promise2.succeed('value')
        .finally(finallyCallback)
        .fail(errorHandler);

      await pr;

      expect(finallyCallback).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith('finally failure');
    });

    it('should handle finally callback that returns a throwing Promise2', async () => {
      const finallyCallback = jest.fn(() => Promise2.throw('finally error'));
      const errorHandler = jest.fn();

      const pr = Promise2.succeed('value')
        .finally(finallyCallback)
        .catch(errorHandler);

      await pr;

      expect(finallyCallback).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith('finally error');
    });

    it('should handle finally callback that returns a native Promise', async () => {
      const finallyCallback = jest.fn(() => Promise.resolve('native promise'));
      const successHandler = jest.fn();

      const pr = Promise2.succeed('value')
        .finally(finallyCallback)
        .next(successHandler);

      await pr;

      expect(finallyCallback).toHaveBeenCalledTimes(1);
      expect(successHandler).toHaveBeenCalledWith('value');
    });

    it('should handle finally callback that returns a rejecting native Promise', async () => {
      const finallyCallback = jest.fn(() => Promise.reject('native rejection'));
      const errorHandler = jest.fn();

      const pr = Promise2.succeed('value')
        .finally(finallyCallback)
        .catch(errorHandler);

      await pr;

      expect(finallyCallback).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith('native rejection');
    });
  });

  describe('Integration with other Promise2 features', () => {
    it('should work with Promise2.fromPromise', async () => {
      const finallyCallback = jest.fn();
      const successHandler = jest.fn();

      const nativePromise = Promise.resolve('native value');
      const pr = Promise2.fromPromise(nativePromise)
        .finally(finallyCallback)
        .next(successHandler);

      await pr;

      expect(finallyCallback).toHaveBeenCalledTimes(1);
      expect(successHandler).toHaveBeenCalledWith('native value');
    });

    it('should work with Promise2.fromPromise with rejection', async () => {
      const finallyCallback = jest.fn();
      const errorHandler = jest.fn();

      const nativePromise = Promise.reject('native error');
      const pr = Promise2.fromPromise(nativePromise)
        .finally(finallyCallback)
        .catch(errorHandler);

      await pr;

      expect(finallyCallback).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith('native error');
    });

    it('should work with Promise2.fromPromise with rejectToFail', async () => {
      const finallyCallback = jest.fn();
      const failHandler = jest.fn();

      const nativePromise = Promise.reject('native failure');
      const pr = Promise2.fromPromise(nativePromise, true)
        .finally(finallyCallback)
        .finally(finallyCallback)
        .next(undefined, failHandler);

      await pr;

      expect(finallyCallback).toHaveBeenCalledTimes(2);
      expect(failHandler).toHaveBeenCalledWith('native failure');
    });

    it('should work with nested Promise2 resolution', async () => {
      const finallyCallback = jest.fn();
      const successHandler = jest.fn();

      const innerPromise = new Promise2((success) => {
        setTimeout(() => success('inner'), 1000);
      });

      const pr = Promise2.succeed(innerPromise)
        .finally(finallyCallback)
        .next(successHandler);

      jest.runAllTimers();
      await pr;

      expect(finallyCallback).toHaveBeenCalledTimes(1);
      expect(successHandler).toHaveBeenCalledWith('inner');
    });
  });
}); 