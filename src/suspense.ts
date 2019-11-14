import {
  createEffect,
  createContext,
  useContext,
  sample,
  onCleanup,
  createMemo
} from "./signal";
import { createState, Wrapped } from "./state";

// Suspense Context
export const SuspenseContext = createContext({ state: () => "running" });

interface ComponentType<T> {
  (props: T): any
}

// lazy load a function component asynchronously
export function lazy<T extends ComponentType<any>>(fn: () => Promise<{ default: T }>): T {
  return ((props: any) => {
    const result = loadResource(fn().then(mod => mod.default));
    let Comp: T | Wrapped<T> | undefined;
    return createMemo<T>(
      () => (Comp = result.data) && sample(() => (Comp as T)(props))
    );
  }) as T;
}

// load any async resource
export type ResourceState<T> = { loading: Boolean; data?: T; error?: any };
export function loadResource<T>(fn: () => Promise<T>): Wrapped<ResourceState<T>>;
export function loadResource<T>(p: Promise<T>): Wrapped<ResourceState<T>>;
export function loadResource<T>(resource: any): Wrapped<ResourceState<T>> {
  const { increment, decrement } = useContext(SuspenseContext);
  const [state, setState] = createState<ResourceState<T>>({ loading: false });

  function doRequest(p: Promise<T>, ref?: { cancelled: Boolean }) {
    setState({ loading: true });
    increment && increment();
    p.then(
      (data: T) => !(ref && ref.cancelled) && setState({ data, loading: false })
    )
      .catch((error: any) => setState({ error, loading: false }))
      .finally(() => decrement && decrement());
  }

  if (typeof resource === "function") {
    createEffect(() => {
      let ref = { cancelled: false },
        res = resource();
      if (!res) return setState({ data: undefined, loading: false });
      doRequest(res, ref);
      onCleanup(() => (ref.cancelled = true));
    });
  } else doRequest(resource);

  return state;
}
