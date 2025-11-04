import Promise2 from '../src';

jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });

describe('Promise2.success()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic success handling', () => {
    it('should call success handler when promise succeeds', async () => {
      const successHandler = jest.fn();
      const errorHandler = jest.fn();

      const pr = Promise2.succeed('success')
        .success(successHandler, errorHandler);

      expect(successHandler).toHaveBeenCalledTimes(0);
      expect(errorHandler).toHaveBeenCalledTimes(0);

      await pr;

      expect(successHandler).toHaveBeenCalledWith('success');
      expect(errorHandler).toHaveBeenCalledTimes(0);
    });

    it('should call success handler when promise succeeds with delay', async () => {
      const successHandler = jest.fn();
      const errorHandler = jest.fn();

      const pr = new Promise2((success) => {
        setTimeout(() => success('delayed success'), 1000);
      })
        .success(successHandler, errorHandler);

      expect(successHandler).toHaveBeenCalledTimes(0);
      expect(errorHandler).toHaveBeenCalledTimes(0);

      jest.runAllTimers();
      await pr;

      expect(successHandler).toHaveBeenCalledWith('delayed success');
      expect(errorHandler).toHaveBeenCalledTimes(0);
    });

    it('should not call success handler when promise fails', async () => {
      const successHandler = jest.fn();
      const errorHandler = jest.fn();

      const pr = Promise2.fail('failure')
        .success(successHandler, errorHandler);

      await pr;

      expect(successHandler).toHaveBeenCalledTimes(0);
      expect(errorHandler).toHaveBeenCalledTimes(0);
    });

    it('should call error handler when promise throws', async () => {
      const successHandler = jest.fn();
      const errorHandler = jest.fn();

      const pr = Promise2.throw('error')
        .success(successHandler, errorHandler);

      await pr;

      expect(successHandler).toHaveBeenCalledTimes(0);
      expect(errorHandler).toHaveBeenCalledWith('error');
    });
  });

  describe('Success handler return values', () => {
    it('should handle success handler returning a value', async () => {
      const successHandler = jest.fn(() => 'transformed value');
      const resultHandler = jest.fn();

      const pr = Promise2.succeed('original')
        .success(successHandler)
        .next(resultHandler);

      await pr;

      expect(successHandler).toHaveBeenCalledWith('original');
      expect(resultHandler).toHaveBeenCalledWith('transformed value');
    });

    it('should handle success handler returning a Promise2', async () => {
      const successHandler = jest.fn(() => Promise2.succeed('promise value'));
      const resultHandler = jest.fn();

      const pr = Promise2.succeed('original')
        .success(successHandler)
        .next(resultHandler);

      await pr;

      expect(successHandler).toHaveBeenCalledWith('original');
      expect(resultHandler).toHaveBeenCalledWith('promise value');
    });

    it('should handle success handler throwing', async () => {
      const successHandler = jest.fn(() => {
        throw new Error('success error');
      });
      const errorHandler = jest.fn();

      const pr = Promise2.succeed('value')
        .success(successHandler)
        .catch(errorHandler);

      await pr;

      expect(successHandler).toHaveBeenCalledWith('value');
      expect(errorHandler).toHaveBeenCalledWith(new Error('success error'));
    });
  });

  describe('Error handler behavior', () => {
    it('should handle error handler returning a value', async () => {
      const successHandler = jest.fn();
      const errorHandler = jest.fn(() => 'error recovery');
      const resultHandler = jest.fn();

      const pr = Promise2.throw('error')
        .success(successHandler, errorHandler)
        .next(resultHandler);

      await pr;

      expect(successHandler).toHaveBeenCalledTimes(0);
      expect(errorHandler).toHaveBeenCalledWith('error');
      expect(resultHandler).toHaveBeenCalledWith('error recovery');
    });

    it('should handle error handler returning a Promise2', async () => {
      const successHandler = jest.fn();
      const errorHandler = jest.fn(() => Promise2.succeed('recovery'));
      const resultHandler = jest.fn();

      const pr = Promise2.throw('error')
        .success(successHandler, errorHandler)
        .next(resultHandler);

      await pr;

      expect(successHandler).toHaveBeenCalledTimes(0);
      expect(errorHandler).toHaveBeenCalledWith('error');
      expect(resultHandler).toHaveBeenCalledWith('recovery');
    });

    it('should handle error handler throwing', async () => {
      const successHandler = jest.fn();
      const errorHandler = jest.fn(() => {
        throw new Error('error handler error');
      });
      const finalErrorHandler = jest.fn();

      const pr = Promise2.throw('original error')
        .success(successHandler, errorHandler)
        .catch(finalErrorHandler);

      await pr;

      expect(successHandler).toHaveBeenCalledTimes(0);
      expect(errorHandler).toHaveBeenCalledWith('original error');
      expect(finalErrorHandler).toHaveBeenCalledWith(new Error('error handler error'));
    });
  });

  describe('Chaining', () => {
    it('should chain multiple success calls', async () => {
      const handler1 = jest.fn((val) => val + '1');
      const handler2 = jest.fn((val) => val + '2');
      const handler3 = jest.fn((val) => val + '3');
      const finalHandler = jest.fn();

      const pr = Promise2.succeed('start')
        .success(handler1)
        .success(handler2)
        .success(handler3)
        .next(finalHandler);

      await pr;

      expect(handler1).toHaveBeenCalledWith('start');
      expect(handler2).toHaveBeenCalledWith('start1');
      expect(handler3).toHaveBeenCalledWith('start12');
      expect(finalHandler).toHaveBeenCalledWith('start123');
    });

    it('should work with other Promise2 methods', async () => {
      const successHandler = jest.fn((val) => val.toUpperCase());
      const failHandler = jest.fn();
      const errorHandler = jest.fn();
      const finalHandler = jest.fn();

      const pr = Promise2.succeed('hello')
        .success(successHandler)
        .fail(failHandler)
        .catch(errorHandler)
        .next(finalHandler);

      await pr;

      expect(successHandler).toHaveBeenCalledWith('hello');
      expect(failHandler).toHaveBeenCalledTimes(0);
      expect(errorHandler).toHaveBeenCalledTimes(0);
      expect(finalHandler).toHaveBeenCalledWith('HELLO');
    });
  });
}); 