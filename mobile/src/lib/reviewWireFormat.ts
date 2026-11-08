// JSON-only subset of the website's TanStack/Seroval wire format. Do not import
// seroval into the native bundle: its eager well-known Symbol table crashes on
// Hermes versions without all thirteen symbols. Reviews need only plain data.
type WireNode = {
  t: number;
  i?: number;
  s?: unknown;
  a?: WireNode[];
  p?: { k: string[]; v: WireNode[] };
  c?: string;
  o?: number;
};

const escapes: Record<string, string> = {
  '"': '\\"', '\\': '\\\\', '\n': '\\n', '\r': '\\r', '\b': '\\b',
  '\t': '\\t', '\f': '\\f', '<': '\\x3C', '\u2028': '\\u2028', '\u2029': '\\u2029',
};
const unescapes = Object.fromEntries(Object.entries(escapes).map(([key, value]) => [value, key]));
const escapeString = (value: string) => value.replace(/["\\\n\r\b\t\f<\u2028\u2029]/g, char => escapes[char]);
const unescapeString = (value: string) => value.replace(/\\(?:\\|"|n|r|b|t|f|u2028|u2029|x3C)/g, sequence => unescapes[sequence]);

export function encodeReviewRequest(data: unknown) {
  let nextId = 0;
  function encode(value: unknown, depth = 0): WireNode {
    if (depth > 32) throw new Error('Review payload too deep');
    if (value === null) return { t: 2, s: 0 };
    if (value === undefined) return { t: 2, s: 1 };
    if (typeof value === 'boolean') return { t: 2, s: value ? 2 : 3 };
    if (typeof value === 'string') return { t: 1, s: escapeString(value) };
    if (typeof value === 'number' && Number.isFinite(value)) return { t: 0, s: value };
    if (Array.isArray(value)) return { t: 9, i: nextId++, a: value.map(item => encode(item, depth + 1)), o: 0 };
    if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
      const id = nextId++;
      const keys = Object.keys(value);
      return { t: 10, i: id, p: { k: keys.map(escapeString), v: keys.map(key => encode((value as Record<string, unknown>)[key], depth + 1)) }, o: 0 };
    }
    throw new Error('Unsupported review payload');
  }
  return { t: encode({ data }), f: 0, m: [] };
}

export function decodeReviewResponse(input: unknown): unknown {
  const refs = new Map<number, unknown>();
  let count = 0;
  function remember(node: WireNode, value: unknown) {
    if (!Number.isSafeInteger(node.i) || node.i! < 0 || refs.has(node.i!)) throw new Error('Invalid review reference');
    refs.set(node.i!, value);
    return value;
  }
  function decode(raw: unknown, depth = 0): unknown {
    if (depth > 32 || ++count > 100_000 || !raw || typeof raw !== 'object') throw new Error('Invalid review response');
    const node = raw as WireNode;
    switch (node.t) {
      case 0:
        if (typeof node.s !== 'number' || !Number.isFinite(node.s)) throw new Error('Invalid review number');
        return node.s;
      case 1:
        if (typeof node.s !== 'string') throw new Error('Invalid review text');
        return unescapeString(node.s);
      case 2:
        switch (node.s) {
          case 0: return null;
          case 1: return undefined;
          case 2: return true;
          case 3: return false;
          default: throw new Error('Unsupported review constant');
        }
      case 4:
        if (!refs.has(node.i!)) throw new Error('Unknown review reference');
        return refs.get(node.i!);
      case 9: {
        if (!Array.isArray(node.a)) throw new Error('Invalid review array');
        const result: unknown[] = [];
        remember(node, result);
        for (const child of node.a) result.push(decode(child, depth + 1));
        return result;
      }
      case 10:
      case 11: {
        if (!node.p || !Array.isArray(node.p.k) || !Array.isArray(node.p.v) || node.p.k.length !== node.p.v.length) throw new Error('Invalid review object');
        const result: Record<string, unknown> = {};
        remember(node, result);
        node.p.k.forEach((key, index) => {
          if (typeof key !== 'string') throw new Error('Invalid review key');
          // Define a data property, including for __proto__; never invoke setters.
          Object.defineProperty(result, unescapeString(key), { value: decode(node.p!.v[index], depth + 1), enumerable: true, writable: true, configurable: true });
        });
        return result;
      }
      case 25: {
        if (node.c !== '$TSR/Error' || !node.s || typeof node.s !== 'object') throw new Error('Unsupported review plugin');
        const message = decode((node.s as Record<string, unknown>).message, depth + 1);
        if (typeof message !== 'string') throw new Error('Invalid review error');
        return remember(node, new Error(message));
      }
      default: throw new Error('Unsupported review response');
    }
  }
  return decode(input);
}
