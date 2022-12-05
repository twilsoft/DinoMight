type ErrMatcher<E, R> = (error: E) => R;
type ValueMatcher<V, R> = (value: V) => R;
type MightMatcher<V, E> = <R>(
  onValue: ValueMatcher<V, R>,
  onError: ErrMatcher<E, R>
) => R;

type WithValue<V, R> = (value: V) => R;

type IMightResult<V, E> = {
  isOk: boolean;
  isError: boolean;
  match: MightMatcher<V, E>;
  withValue: <R>(withValueFunc: (value: V) => R) => Might<R, E>;
  withError: <R>(withErrorFunc: (value: E) => R) => Might<V, R>;
  recover: (recoverFunc: (error: E) => V) => Ok<V, E>;
  pipe: <IV, IE>(target: (value: V) => Might<IV, IE>) => Might<IV, E | IE>;
  peek: () => V | undefined;
};

type Ok<V, E> = IMightResult<V, E> & {
  isOk: true;
  isError: false;
  value: V;
};

type Err<E, V> = IMightResult<V, E> & {
  isOk: false;
  isError: true;
  error: E;
};

export type Might<V, E> = Ok<V, E> | Err<E, V>;

export const ok = <V, E = unknown>(value: V): Ok<V, E> => {
  const match: MightMatcher<V, E> = (onValue, _) => onValue(value);
  const withValue = <R>(func: WithValue<V, R>) => ok<R, E>(func(value));
  const withError = <R>() => ok<V, R>(value);
  const recover = () => ok<V, E>(value);
  const pipe = <IE, IV>(target: (value: V) => Might<IV, IE>) => target(value);
  const peek = () => value;

  return {
    isOk: true,
    isError: false,
    value: value,
    match,
    withValue,
    withError,
    recover,
    pipe,
    peek,
  };
};

export const err = <E, V = unknown>(error: E): Err<E, V> => {
  const match: MightMatcher<V, E> = (_, onError) => onError(error);
  const withError = <R>(func: WithValue<E, R>) => err<R, V>(func(error));
  const withValue = <R>() => err<E, R>(error);
  const recover = (func: (error: E) => V) => ok<V, E>(func(error));
  const pipe = <IV>() => err<E, IV>(error);
  const peek = () => undefined;

  return {
    isOk: false,
    isError: true,
    error: error,
    match,
    withValue,
    withError,
    recover,
    pipe,
    peek,
  };
};
