// deno-lint-ignore no-explicit-any
type Function = (...args: any[]) => any;
// deno-lint-ignore no-explicit-any
type AsyncFunction = (...args: any[]) => Promise<any>;

type MightBaseProps = {
  readonly match: unknown;
  readonly withValue: unknown;
  readonly withError: unknown;
  readonly pipe: unknown;
  readonly peek: unknown;
};
type IncludeMightProps<I extends MightBaseProps> = I;

type ErrMatcher<E, R> = (error: E) => R;
type ErrMatcherAsync<E, R> = (error: E) => Promise<R> | R;
type ValueMatcher<V, R> = (value: V) => R;
type ValueMatcherAsync<V, R> = (value: V) => Promise<R> | R;
type MightMatcher<V, E> = <R>(
  onValue: ValueMatcher<V, R>,
  onError: ErrMatcher<E, R>
) => R;
type MightMatcherAsync<V, E> = <R>(
  onValue: ValueMatcherAsync<V, R>,
  onError: ErrMatcherAsync<E, R>
) => Promise<R>;
type WithValue<V, R> = (value: V) => R;

type IMightResult<V, E> = IncludeMightProps<{
  readonly match: MightMatcher<V, E>;
  readonly withValue: <R>(withValueFunc: (value: V) => R) => Might<R, E>;
  readonly withError: <R>(withErrorFunc: (value: E) => R) => Might<V, R>;
  readonly pipe: <IV, IE>(
    target: (value: V) => Might<IV, IE>
  ) => Might<IV, E | IE>;
  readonly peek: <T>(defaultValue: T) => V | T;
}>;

/** @description an unseresolved async result */
export type MightAsync<V, E> = IncludeMightProps<{
  readonly match: MightMatcherAsync<V, E>;
  readonly withValue: <R>(
    withValueFunc: (value: V) => R
  ) => MightAsync<V | R, E>;
  readonly withError: <R>(
    withErrorFunc: (value: E) => R
  ) => MightAsync<V, E | R>;
  readonly pipe: <IV, IE>(
    target: (value: V) => Might<IV, IE> | MightAsync<IV, IE>
  ) => MightAsync<IV, E | IE>;
  readonly peek: <T>(defaultValue: T) => Promise<V | T>;
}> &
  Promise<Might<V, E>>;

/** @description A successful result */
export type Ok<V, E> = IMightResult<V, E> & {
  readonly isOk: true;
  readonly isError: false;
  readonly value: V;
  readonly peek: () => V;
};

/** @description An errored result */
export type Err<E, V> = IMightResult<V, E> & {
  readonly isOk: false;
  readonly isError: true;
  readonly error: E;
  readonly peek: <T>(defaultValue: T) => T;
};

/** @description Represents a value that *might* be an error */
export type Might<V, E> = Ok<V, E> | Err<E, V>;

/** @description Creates an Ok of type V */
export const ok = <V, E = unknown>(value: V): Ok<V, E> => {
  const match: MightMatcher<V, E> = (onValue, _) => onValue(value);
  const withValue = <R>(func: WithValue<V, R>) => ok<R, E>(func(value));
  const withError = <R>() => ok<V, R>(value);
  const recover = () => ok<V, E>(value);
  const pipe = <IE, IV>(target: (value: V) => Might<IV, IE>) => target(value);
  const peek = () => value;

  return Object.freeze({
    isOk: true,
    isError: false,
    value: value,
    match,
    withValue,
    withError,
    recover,
    pipe,
    peek,
  });
};

/** @description Creates an Error of type E */
export const err = <E, V = unknown>(error: E): Err<E, V> => {
  const match: MightMatcher<V, E> = (_, onError) => onError(error);
  const withError = <R>(func: WithValue<E, R>) => err<R, V>(func(error));
  const withValue = <R>() => err<E, R>(error);
  const recover = (func: (error: E) => V) => ok<V, E>(func(error));
  const pipe = <IV>() => err<E, IV>(error);
  const peek = <T>(defaultValue: T) => defaultValue;

  return Object.freeze({
    isOk: false,
    isError: true,
    error: error,
    match,
    withValue,
    withError,
    recover,
    pipe,
    peek,
  });
};

/** @description converts a function to return a Might result */
export const mightify =
  <F extends Function, E = unknown>(
    func: F,
    transformError: (error: unknown) => E
  ): ((...args: Parameters<F>) => Might<ReturnType<F>, E>) =>
  (...args) => {
    try {
      return ok(func(...args));
    } catch (error) {
      return err(transformError(error));
    }
  };

/** @description wrap a promise so that it can be manipulated as a result */
export const mightPromise = <V, E = unknown>(
  prom: Promise<V>,
  transformError: (err: unknown) => E
): MightAsync<V, E> => ({
  [Symbol.toStringTag]: prom[Symbol.toStringTag] + ":mightified",
  match: (onSuccess, onError) =>
    prom.then(
      (value) => onSuccess(value),
      (error) => onError(transformError(error))
    ),
  withError: (func) =>
    mightPromise(
      prom.then(
        () => prom,
        (err) => err
      ),
      (err) => func(transformError(err))
    ),
  withValue: (func) =>
    mightPromise(
      prom.then(
        (value) => func(value),
        () => prom
      ),
      transformError
    ),
  pipe: (func) =>
    mightPromise(
      new Promise((resolve, reject) => {
        prom.then(
          (value) =>
            Promise.resolve(func(value)).then((result) =>
              result.isOk ? resolve(result.value) : reject(result.error)
            ),
          (_error) => prom
        );
      }),
      transformError
    ),
  peek: (defaultValue) =>
    prom.then(
      (value) => value,
      () => defaultValue
    ),
  then: (onSuccess, onError) =>
    prom.then(
      (value) => (onSuccess ? onSuccess(ok(value)) : value),
      (error) => (onError ? onError(err(transformError(error))) : error)
    ),
  catch: (onError) =>
    prom.catch((error) =>
      onError ? onError(err(transformError(error))) : error
    ),
  finally: (func) => mightPromise(prom.finally(func), transformError),
});

/** @description convert an async function to return a MightAsync result */
export const mightifyAsync =
  <F extends AsyncFunction, E = unknown>(
    func: F,
    transformError: (error: unknown) => E
  ): ((...args: Parameters<F>) => MightAsync<Awaited<ReturnType<F>>, E>) =>
  (...args) =>
    mightPromise<Awaited<ReturnType<F>>, E>(func(...args), transformError);
