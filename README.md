# Promise 2

An alternative Promise library that separate Error and Exception concerns.
Errors are `expected failures` while Exceptions `unexcpected`

## Usage

### Instantiating

Promise2 allows you to create PromiseLike object in a very close manner to original Promise

```typescript
import Promise2 from '@pervozdanniy/promise2';

new Promise2((success, fail, error) => {
  success('value');
});

Promise2.succeed('value'); // Promise2<string, never>
Promise2.fail('value'); // Promise2<never, string>
Promise2.throw('value'); // Promise2<never, never>
```

### Compatibility

Promise2 implements `PromiseLike` interface so it could be `await`ed or `then`ed in same manner as native Promise.
But with one important difference: Promise2 object resolve to a tuple `[Err | null, Value?]`

```typescript
const pr = Promise2.succeed('Ok value');
pr.then(value /* [null, 'Ok value'] */ => {});
(async () => {
  await pr; // [null, 'Ok value']
})();

const pr2 = Promise2.fail('Reason value');
pr2.then(value /* ['Reason value', undefined] */ => {});
(async () => {
  await pr2; // ['Reason value', undefined]
})();

const pr3 = Promise2.throw('Exception value');
pr3.then(value => {}, err /* 'Exception value' */ => {});
(async () => {
  try {
    await pr3;
  } catch (err /* 'Exception value' */) {}
})();

```

### Chaining and processing

Promise2 offers similar to `then` method to work with 2-way Value/Error flow:

```typescript
Promise2.succeed('value').next(value /* value */ => {}, reason => {}, exception => {});
Promise2.fail('value').next(value => {}, reason /* value */ => {}, exception => {});
Promise2.throw('value').next(value => {}, reason => {}, exception /* value */ => {});
```

and set of shortcut helper methods

```typescript
Promise2.succeed('value').done(value /* value */ => {});
Promise2.fail('value').fail(value /* value */ => {});
Promise2.throw('value').catch(value /* value */ => {});
```

Any of this methods return new Promise2 object.

### State flow

Unlike native Promise's 3 states(`pending`, `fullfilled` and `rejected`)
Promise2 object has 4 inner states:

```typescript
enum State {
  PENDING,
  SUCCESS,
  FAIL,
  ERROR,
}
```

Like native Promise, exception handler (e.g `.catch()` or `.next() 3d argument`) callback returns Promise2
with `SUCCESS` state if no other state returned explicitly:

```typescript
// native Promise behavior
Promise.reject(new Error('some err')).catch(err => err).then(value /* Error('some err') */ => {}, reason => {});
Promise.reject(new Error('some err')).catch(err => Promise.reject(err)).then(value => {}, reason /* Error('some err') */ => {});
Promise.reject(new Error('some err')).catch(err => { throw err; }).then(value => {}, reason /* Error('some err') */ => {});


Promise2.throw(new Error('some err')).catch((err) => err).next(value /* Error('some err') */ => {}, fail => {}, err => {});
Promise2.throw(new Error('some err')).catch((err) => Promise2.throw(err)).next(value => {}, fail => {}, err /* Error('some err') */ => {});
Promise2.throw(new Error('some err')).catch((err) => { throw err; }).next(value => {}, fail => {}, err /* Error('some err') */ => {});
```

Unlike exception handler success and fail (`.done()` and `.fail()`) handlers keeps original promise state if no other
state returned explicitly:

```typescript
Promise2.succeed('value').done(value => value).next(value /* 'value' */ => {}, fail => {}, err => {});
Promise2.fail('value').fail(value => value).next(value => {}, fail /* 'value' */ => {}, err => {});
```

As stated earlier you can change state of resulting Promise2 object by returning Promise2 instance from handler:

```typescript
Promise2.fail('value').fail(value => Promise2.succeed(value)).next(value /* 'value' */ => {}, fail => {}, err => {});
Promise2.fail('value').fail(value => Promise2.throw(value)).next(value => {}, fail => {}, err /* 'value' */ => {});
```