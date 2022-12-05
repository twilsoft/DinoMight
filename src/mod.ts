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
  withValue: <R>(func: WithValue<V, R>) => Might<R, E>;
  withError: <R>(func: WithValue<E, R>) => Might<V, R>;
  // unwrap: (<F>(fallback?: F) => F | V) & (() => V | undefined);
};

type Ok<V, E = never> = IMightResult<V, E> & {
  isOk: true;
  isError: false;
  value: V;
};

type Err<E, V = never> = IMightResult<V, E> & {
  isOk: false;
  isError: true;
  error: E;
};

export type Might<V, E> = Ok<V> | Err<E>;

export const ok = <V, E = never>(value: V): Ok<V, E> => {
  const match: MightMatcher<V, never> = (onValue, _) => onValue(value);
  const withValue = <R>(func: WithValue<V, R>) => ok(func(value));
  const withError = () => ok(value);
  const unwrap = () => value;

  return {
    isOk: true,
    isError: false,
    value: value,
    match,
    withValue,
    withError,
    // unwrap,
  };
};

export const err = <E, V = never>(error: E): Err<E, V> => {
  const match: MightMatcher<never, E> = (_, onError) => onError(error);
  const withError = <R>(func: WithValue<E, R>) => err(func(error));
  const withValue = () => err(error);
  const unwrap = (fallback: any) => fallback;

  return {
    isOk: false,
    isError: true,
    error: error,
    match,
    withValue,
    withError,
    // unwrap,
  };
};
