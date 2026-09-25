/**
 * Safe serializer for crossing the Web Worker postMessage boundary.
 * Handles circular references, BigInt, Symbol, Map, Set, Date, RegExp,
 * Error objects, and deeply nested structures.
 */

export type SerializedValue =
  | { __type: 'primitive'; value: string | number | boolean | null | undefined }
  | { __type: 'bigint'; value: string }
  | { __type: 'symbol'; value: string }
  | { __type: 'date'; value: string }
  | { __type: 'regexp'; value: string }
  | { __type: 'error'; message: string; name: string; stack?: string }
  | { __type: 'function'; value: string }
  | { __type: 'circular'; ref: string }
  | { __type: 'map'; entries: Array<[SerializedValue, SerializedValue]> }
  | { __type: 'set'; values: SerializedValue[] }
  | { __type: 'array'; items: SerializedValue[]; length: number }
  | { __type: 'object'; keys: string[]; values: SerializedValue[]; constructorName?: string };

const MAX_DEPTH = 10;
const MAX_ARRAY_ITEMS = 100;
const MAX_OBJECT_KEYS = 50;

export function serialize(
  value: unknown,
  seen: Map<object, string> = new Map(),
  path = 'root',
  depth = 0
): SerializedValue {
  if (depth > MAX_DEPTH) {
    return { __type: 'primitive', value: '[Max depth exceeded]' };
  }

  // Primitives
  if (
    value === null ||
    value === undefined ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return { __type: 'primitive', value };
  }

  if (typeof value === 'bigint') {
    return { __type: 'bigint', value: value.toString() };
  }

  if (typeof value === 'symbol') {
    return { __type: 'symbol', value: value.toString() };
  }

  if (typeof value === 'function') {
    const name = value.name ? `ƒ ${value.name}()` : 'ƒ anonymous()';
    return { __type: 'function', value: name };
  }

  // Objects (check circular refs)
  const obj = value as object;
  const existingPath = seen.get(obj);
  if (existingPath !== undefined) {
    return { __type: 'circular', ref: existingPath };
  }
  seen.set(obj, path);

  if (value instanceof Error) {
    return {
      __type: 'error',
      message: value.message,
      name: value.name,
      stack: value.stack,
    };
  }

  if (value instanceof Date) {
    return { __type: 'date', value: value.toISOString() };
  }

  if (value instanceof RegExp) {
    return { __type: 'regexp', value: value.toString() };
  }

  if (value instanceof Map) {
    const entries: Array<[SerializedValue, SerializedValue]> = [];
    let i = 0;
    for (const [k, v] of value) {
      if (i >= MAX_OBJECT_KEYS) break;
      entries.push([
        serialize(k, seen, `${path}.Map[${i}].key`, depth + 1),
        serialize(v, seen, `${path}.Map[${i}].val`, depth + 1),
      ]);
      i++;
    }
    return { __type: 'map', entries };
  }

  if (value instanceof Set) {
    const values: SerializedValue[] = [];
    let i = 0;
    for (const v of value) {
      if (i >= MAX_ARRAY_ITEMS) break;
      values.push(serialize(v, seen, `${path}.Set[${i}]`, depth + 1));
      i++;
    }
    return { __type: 'set', values };
  }

  if (Array.isArray(value)) {
    const length = value.length;
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item, i) =>
      serialize(item, seen, `${path}[${i}]`, depth + 1)
    );
    return { __type: 'array', items, length };
  }

  // Plain object or class instance
  const keys = Object.keys(obj).slice(0, MAX_OBJECT_KEYS);
  const values: SerializedValue[] = keys.map((k) =>
    serialize((obj as Record<string, unknown>)[k], seen, `${path}.${k}`, depth + 1)
  );
  const constructorName =
    obj.constructor && obj.constructor.name !== 'Object' ? obj.constructor.name : undefined;

  return { __type: 'object', keys, values, constructorName };
}

export function serializeArgs(args: unknown[]): SerializedValue[] {
  const seen = new Map<object, string>();
  return args.map((arg, i) => serialize(arg, seen, `arg${i}`));
}
