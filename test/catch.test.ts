import Promise2 from '../src';

jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });

describe('Promise2.catch()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic error handling', () => {
    it('should call catch handler when promise throws', async () => {
      const catchHandler = jest.fn();

      const pr = Promise2.throw('error')
        .catch(catchHandler);

      expect(catchHandler).toHaveBeenCalledTimes(0);

      await pr;

      expect(catchHandler).toHaveBeenCalledWith('error');
    });

    it('should call catch handler when promise throws with delay', async () => {
      const catchHandler = jest.fn();

      const pr = new Promise2((_, __, error) => {
        setTimeout(() => error('delayed error'), 1000);
      })
        .catch(catchHandler);

      expect(catchHandler).toHaveBeenCalledTimes(0);

      jest.runAllTimers();
      await pr;

      expect(catchHandler).toHaveBeenCalledWith('delayed error');
    });

    it('should not call catch handler when promise succeeds', async () => {
      const catchHandler = jest.fn();
      const successHandler = jest.fn();

      const pr = Promise2.succeed('success')
        .catch(catchHandler)
        .next(successHandler);

      await pr;

      expect(catchHandler).toHaveBeenCalledTimes(0);
      expect(successHandler).toHaveBeenCalledWith('success');
    });

    it('should not call catch handler when promise fails', async () => {
      const catchHandler = jest.fn();
      const failHandler = jest.fn();

      const pr = Promise2.fail('failure')
        .catch(catchHandler)
        .fail(failHandler);

      await pr;

      expect(catchHandler).toHaveBeenCalledTimes(0);
      expect(failHandler).toHaveBeenCalledWith('failure');
    });
  });

  describe('Catch handler return values', () => {
    it('should handle catch handler returning a value', async () => {
      const catchHandler = jest.fn(() => 'recovery value');
      const resultHandler = jest.fn();

      const pr = Promise2.throw('error')
        .catch(catchHandler)
        .success(resultHandler);

      await pr;

      expect(catchHandler).toHaveBeenCalledWith('error');
      expect(resultHandler).toHaveBeenCalledWith('recovery value');
    });

    it('should handle catch handler returning a Promise2', async () => {
      const catchHandler = jest.fn(() => Promise2.succeed('recovery promise'));
      const resultHandler = jest.fn();

      const pr = Promise2.throw('error')
        .catch(catchHandler)
        .success(resultHandler);

      await pr;

      expect(catchHandler).toHaveBeenCalledWith('error');
      expect(resultHandler).toHaveBeenCalledWith('recovery promise');
    });

    it('should handle catch handler throwing', async () => {
      const catchHandler = jest.fn(() => {
        throw new Error('catch handler error');
      });
      const finalErrorHandler = jest.fn();

      const pr = Promise2.throw('original error')
        .catch(catchHandler)
        .catch(finalErrorHandler);

      await pr;

      expect(catchHandler).toHaveBeenCalledWith('original error');
      expect(finalErrorHandler).toHaveBeenCalledWith(new Error('catch handler error'));
    });
  });

  describe('Chaining', () => {
    it('should chain multiple catch calls', async () => {
      const handler1 = jest.fn((err) => err + '1');
      const handler2 = jest.fn((err) => err + '2');
      const handler3 = jest.fn((err) => err + '3');
      const finalHandler = jest.fn();

      const pr = Promise2.throw('start')
        .catch(handler1)
        .catch(handler2)
        .catch(handler3)
        .next(finalHandler);

      await pr;

      expect(handler1).toHaveBeenCalledWith('start');
      expect(handler2).toHaveBeenCalledTimes(0);
      expect(handler3).toHaveBeenCalledTimes(0);
      expect(finalHandler).toHaveBeenCalledWith('start1');
    });

    it('should work with other Promise2 methods', async () => {
      const successHandler = jest.fn();
      const failHandler = jest.fn();
      const catchHandler = jest.fn((err) => err.toUpperCase());
      const finalHandler = jest.fn();

      const pr = Promise2.throw('hello')
        .success(successHandler)
        .fail(failHandler)
        .catch(catchHandler)
        .next(finalHandler);

      await pr;

      expect(successHandler).toHaveBeenCalledTimes(0);
      expect(failHandler).toHaveBeenCalledTimes(0);
      expect(catchHandler).toHaveBeenCalledWith('hello');
      expect(finalHandler).toHaveBeenCalledWith('HELLO');
    });
  });

  describe('State transitions', () => {
    it('should handle catch after success state change', async () => {
      const catchHandler = jest.fn();
      const finalHandler = jest.fn();

      const pr = Promise2.succeed('start')
        .next(() => Promise2.throw('changed'))
        .catch(catchHandler)
        .next(finalHandler);

      await pr;

      expect(catchHandler).toHaveBeenCalledWith('changed');
      expect(finalHandler).toHaveBeenCalledWith('changed');
    });

    it('should handle catch after fail state change', async () => {
      const catchHandler = jest.fn();
      const failHandler = jest.fn(() => Promise2.throw('fail to error'));
      const finalHandler = jest.fn();

      const pr = Promise2.fail('failure')
        .fail(failHandler)
        .catch(catchHandler)
        .next(finalHandler);

      await pr;

      expect(catchHandler).toHaveBeenCalledWith('fail to error');
      expect(finalHandler).toHaveBeenCalledWith('fail to error');
    });
  });

  describe('Error propagation', () => {
    it('should immediately throw error when no catch handler is provided', async () => {
      expect.assertions(1);
      try {
        await Promise2.throw('unhandled error');
      } catch (error) {
        console.log('ERROR', error);
        expect(error).toBe('unhandled error');
      }
    });

    it('should handle multiple error sources', async () => {
      const catchHandler = jest.fn();

      const pr = Promise2.throw('first error')
        .catch(catchHandler)
        .next(() => Promise2.throw('second error'))
        .catch(catchHandler);

      await pr;

      expect(catchHandler).toHaveBeenCalledTimes(2);
      expect(catchHandler).toHaveBeenNthCalledWith(1, 'first error');
      expect(catchHandler).toHaveBeenNthCalledWith(2, 'second error');
    });
  });

  describe('Integration with native promises', () => {
    it('should handle errors from Promise2.fromPromise', async () => {
      const catchHandler = jest.fn();

      const nativePromise = Promise.reject('native error');
      const pr = Promise2.fromPromise(nativePromise)
        .catch(catchHandler);

      await pr;

      expect(catchHandler).toHaveBeenCalledWith('native error');
    });

    it('should handle errors from Promise2.fromPromise with rejectToFail', async () => {
      const catchHandler = jest.fn();
      const failHandler = jest.fn();

      const nativePromise = Promise.reject('native error');
      const pr = Promise2.fromPromise(nativePromise, true)
        .catch(catchHandler)
        .next(undefined, failHandler);

      await pr;

      expect(catchHandler).toHaveBeenCalledTimes(0);
      expect(failHandler).toHaveBeenCalledWith('native error');
    });
  });
}); 