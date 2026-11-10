/**
 * Safe serializer for crossing the Web Worker postMessage boundary.
 * Handles circular references, BigInt, Symbol, Map, Set, Date, RegExp,
 * Error objects, prototypes, and deeply nested structures.
 */

export type SerializedValue =
  | { __type: 'primitive'; value: string | number | boolean | null | undefined }
  | { __type: 'bigint'; value: string }
  | { __type: 'symbol'; value: string }
  | { __type: 'date'; value: string }
  | { __type: 'regexp'; value: string }
  | { __type: 'error'; message: string; name: string; stack?: string; lineNumber?: number }
  | { __type: 'function'; value: string }
  | { __type: 'circular'; ref: string }
  | { __type: 'map'; entries: Array<[SerializedValue, SerializedValue]> }
  | { __type: 'set'; values: SerializedValue[] }
  | {
      __type: 'array';
      items: SerializedValue[];
      length: number;
      isPrototype?: boolean;
      prototypeName?: string;
      keys?: string[];
      values?: SerializedValue[];
      proto?: SerializedValue;
    }
  | {
      __type: 'object';
      keys: string[];
      values: SerializedValue[];
      constructorName?: string;
      isPrototype?: boolean;
      prototypeName?: string;
      proto?: SerializedValue;
    };

const MAX_DEPTH = 10;
const MAX_ARRAY_ITEMS = 100;
const MAX_OBJECT_KEYS = 80;

function isPrototypeObject(obj: unknown): boolean {
  if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) return false;
  try {
    return !!(
      (obj as any).constructor &&
      typeof (obj as any).constructor === 'function' &&
      (obj as any).constructor.prototype === obj
    );
  } catch {
    return false;
  }
}

function getPrototypeName(obj: any): string {
  try {
    const ctor = obj.constructor;
    if (ctor && typeof ctor === 'function' && ctor.name) {
      return `${ctor.name}.prototype`;
    }
  } catch {}
  return 'prototype';
}

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

  // ── Special handling for Prototype objects (e.g. Array.prototype, Object.prototype) ──
  const isProto = isPrototypeObject(value);
  if (isProto) {
    let propNames: string[] = [];
    try {
      const names = Object.getOwnPropertyNames(obj);
      const symbols = Object.getOwnPropertySymbols(obj).map(s => s.toString());
      const withoutCtor = names.filter(n => n !== 'constructor');
      withoutCtor.sort();
      propNames = (names.includes('constructor') ? ['constructor', ...withoutCtor] : withoutCtor).concat(symbols);
    } catch {
      propNames = Object.keys(obj);
    }

    const keys = propNames.slice(0, MAX_OBJECT_KEYS);
    const values: SerializedValue[] = keys.map(k => {
      let propVal: unknown;
      try {
        const desc = Object.getOwnPropertyDescriptor(obj, k);
        if (desc && 'value' in desc) {
          propVal = desc.value;
        } else if (desc && (desc.get || desc.set)) {
          propVal = desc.get ? 'ƒ [Getter]' : 'ƒ [Setter]';
        } else {
          propVal = (obj as any)[k];
        }
      } catch (e: any) {
        propVal = `[Error: ${e?.message ?? 'inaccessible'}]`;
      }
      return serialize(propVal, seen, `${path}.${k}`, depth + 1);
    });

    const prototypeName = getPrototypeName(obj);

    let protoVal: SerializedValue | undefined;
    if (depth < 3) {
      try {
        const proto = Object.getPrototypeOf(obj);
        if (proto !== null && proto !== undefined) {
          protoVal = serialize(proto, seen, `${path}.[[Prototype]]`, depth + 1);
        } else if (proto === null) {
          protoVal = { __type: 'primitive', value: null };
        }
      } catch {}
    }

    const isArrayProto = Array.isArray(value);
    if (isArrayProto) {
      return {
        __type: 'array',
        items: [],
        length: (obj as any).length ?? 0,
        isPrototype: true,
        prototypeName,
        keys,
        values,
        proto: protoVal,
      };
    }

    return {
      __type: 'object',
      keys,
      values,
      constructorName: prototypeName === 'Object.prototype' ? undefined : prototypeName,
      isPrototype: true,
      prototypeName,
      proto: protoVal,
    };
  }

  // ── Arrays ──────────────────────────────────────────────────────────────────────────
  if (Array.isArray(value)) {
    const length = value.length;
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item, i) =>
      serialize(item, seen, `${path}[${i}]`, depth + 1)
    );

    let protoVal: SerializedValue | undefined;
    if (depth < 2) {
      try {
        const proto = Object.getPrototypeOf(value);
        if (proto !== null && proto !== undefined) {
          protoVal = serialize(proto, seen, `${path}.[[Prototype]]`, depth + 1);
        }
      } catch {}
    }

    return { __type: 'array', items, length, proto: protoVal };
  }

  // ── Regular Plain Object or Class Instance ───────────────────────────────────────────
  const keys = Object.keys(obj).slice(0, MAX_OBJECT_KEYS);
  const values: SerializedValue[] = keys.map((k) =>
    serialize((obj as Record<string, unknown>)[k], seen, `${path}.${k}`, depth + 1)
  );

  let constructorName: string | undefined;
  try {
    if (obj.constructor && obj.constructor.name && obj.constructor.name !== 'Object') {
      constructorName = obj.constructor.name;
    } else if (Object.getPrototypeOf(obj) === null) {
      constructorName = '[Object: null prototype]';
    }
  } catch {}

  let protoVal: SerializedValue | undefined;
  if (depth < 2) {
    try {
      const proto = Object.getPrototypeOf(obj);
      if (proto !== null && proto !== undefined) {
        protoVal = serialize(proto, seen, `${path}.[[Prototype]]`, depth + 1);
      } else if (proto === null) {
        protoVal = { __type: 'primitive', value: null };
      }
    } catch {}
  }

  return { __type: 'object', keys, values, constructorName, proto: protoVal };
}

export function serializeArgs(args: unknown[]): SerializedValue[] {
  const seen = new Map<object, string>();
  return args.map((arg, i) => serialize(arg, seen, `arg${i}`));
}
