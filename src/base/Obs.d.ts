/**
 * Type boundary for the legacy event-stream implementation in Obs.js.
 * The bounded check validates consumers against this API, not that implementation.
 */
export class Observable<T = unknown> {
  constructor(subscribe: (observer: (value: T) => void) => () => void);
  subscribe(observer: (value: T) => void): () => void;
  static of<T>(...items: T[]): Observable<T>;
  snapshot(): T[];
  map<U>(transform: (value: T) => U): Observable<U>;
  filter(predicate: (value: T) => boolean): Observable<T>;
  zipLatest<U, V>(
    other: Observable<U>,
    merge: (value: T, other: U) => V,
  ): Observable<V>;
  flattenLatest<U>(this: Observable<Observable<U>>): Observable<U>;
  peek(action: (value: T) => void): Observable<T>;
  flatten<U>(this: Observable<Observable<U>>): Observable<U>;
  throttleLatest(cooldownMillis: number): Observable<T>;
  static elementEvent(
    element: HTMLElement | HTMLDocument,
    eventKey: string,
  ): Observable<Event>;
  skip(count: number): Observable<T>;
  whenDifferent(equater?: (previous: T, current: T) => boolean): Observable<T>;
}

export class ObservableSource<T = unknown> {
  constructor();
  observable(): Observable<T>;
  send(value: T): void;
}
