import type { SupportedLanguage } from './detectFileType';

export interface CodePreset {
  id: string;
  label: string;
  description: string;
  code: string;
  language?: SupportedLanguage;
}

export const PRESETS: CodePreset[] = [
  {
    id: 'bench-comparison',
    label: '⚡ Benchmarking: Array vs Set vs Map',
    description: 'Uses built-in bench() to compare lookups, ops/sec, and speedup',
    language: 'typescript',
    code: `// ⚡ Built-in Pure-JS Benchmarking: bench(label, fn)
// The scratchpad provides a global \`bench(name, fn)\` function.
// It warms up, measures iterations, calculates ops/sec, and produces a summary!

const size = 1000;
const targetKey = 'item_950';

const array = Array.from({ length: size }, (_, i) => \`item_\${i}\`);
const set = new Set(array);
const map = new Map(array.map(k => [k, true]));
const object = Object.fromEntries(array.map(k => [k, true]));

console.log(\`Benchmarking lookup performance on \${size} items:\\n\`);

// 1. Array.includes (O(n) linear scan)
await bench('Array.includes', () => {
  array.includes(targetKey);
});

// 2. Set.has (O(1) hash lookup)
await bench('Set.has', () => {
  set.has(targetKey);
});

// 3. Map.has (O(1) hash lookup)
await bench('Map.has', () => {
  map.has(targetKey);
});

// 4. Object property access (O(1))
await bench('Object[key]', () => {
  return object[targetKey];
});

// 💡 Notice the automatic 🏆 Benchmark Summary printed at the end!
`,
  },
  {
    id: 'event-loop',
    label: '🔄 Event Loop: Microtasks vs Macrotasks',
    description: 'Visualizes sync vs queueMicrotask vs Promise.then vs setTimeout',
    language: 'javascript',
    code: `// 🔄 JavaScript Event Loop: Execution Order Visualizer
// Demonstrates synchronous execution -> microtasks -> macrotasks

console.log('1. [SYNC] Script start');

setTimeout(() => {
  console.log('6. [MACROTASK] setTimeout callback (Timer)');
}, 0);

Promise.resolve()
  .then(() => {
    console.log('3. [MICROTASK] Promise.then 1');
  })
  .then(() => {
    console.log('5. [MICROTASK] Promise.then 2 (nested microtask)');
  });

queueMicrotask(() => {
  console.log('4. [MICROTASK] queueMicrotask callback');
});

console.log('2. [SYNC] Script end');

// 💡 Why this order?
// 1 & 2: Run synchronously immediately on the call stack.
// 3 & 4: Placed on the Microtask Queue. Run before any macrotask!
// 5: Chained onto the Microtask Queue, executed in the same drain cycle.
// 6: Macrotask (Timer Queue) only executes after the Microtask Queue is completely empty!
`,
  },
  {
    id: 'promise-patterns',
    label: '⚡ Promise Concurrency Patterns',
    description: 'Compares all, allSettled, race, and any with timing',
    language: 'typescript',
    code: `// ⚡ Promise Concurrency Patterns
// Real-world comparison of allSettled, race, and any

const delay = (ms: number, val: unknown, fail = false) =>
  new Promise((resolve, reject) =>
    setTimeout(() => fail ? reject(new Error(String(val))) : resolve(val), ms)
  );

console.log('Running Promise concurrency patterns...');

// 1. Promise.allSettled: Never aborts on rejection; gives status of all promises
console.time('allSettled');
const settled = await Promise.allSettled([
  delay(120, 'User profile loaded'),
  delay(60, 'Avatar image failed (404)', true),
  delay(150, 'Notifications loaded'),
]);
console.timeEnd('allSettled');

console.log('\\n📊 Promise.allSettled results:');
console.table(
  settled.map((s, i) => ({
    task: \`Task \${i + 1}\`,
    status: s.status,
    result: s.status === 'fulfilled' ? s.value : String(s.reason),
  }))
);

// 2. Promise.race: Settles as soon as the first promise settles (resolve OR reject)
console.time('race');
const fastest = await Promise.race([
  delay(110, 'CDN Server A (110ms)'),
  delay(45, 'CDN Server B (45ms)'),
]);
console.timeEnd('race');
console.log('\\n🏎️ Promise.race winner:', fastest);

// 3. Promise.any: Settles as soon as the first promise FULFILLS (ignores early errors)
console.time('any');
const firstSuccess = await Promise.any([
  delay(30, 'Mirror 1 down (503)', true),
  delay(90, 'Mirror 2 ready (90ms)'),
  delay(140, 'Mirror 3 ready (140ms)'),
]);
console.timeEnd('any');
console.log('\\n🎯 Promise.any first success:', firstSuccess);
`,
  },
  {
    id: 'es2024-features',
    label: '✨ Modern ES2024 Features & Sets',
    description: 'Promise.withResolvers, new Set methods, Object.groupBy, structuredClone',
    language: 'typescript',
    code: `// ✨ Modern JavaScript & TypeScript Features
// Pure language features now standard in modern JS engines

console.log('=== 1. Promise.withResolvers() ===');
// No more boilerplate extracting resolve/reject from a Promise callback!
const { promise, resolve } = Promise.withResolvers<string>();
setTimeout(() => resolve('Resolved cleanly from external timer!'), 80);
console.log('Extracted promise value:', await promise);

console.log('\\n=== 2. New Set Methods (Set Operations) ===');
const frontendTeam = new Set(['Alice', 'Bob', 'Charlie']);
const backendTeam = new Set(['Bob', 'Charlie', 'Diana', 'Evan']);

// Union: all unique developers
console.log('Union (all devs):', [...frontendTeam.union(backendTeam)]);

// Intersection: full-stack developers
console.log('Intersection (full-stack):', [...frontendTeam.intersection(backendTeam)]);

// Difference: frontend-only
console.log('Difference (frontend-only):', [...frontendTeam.difference(backendTeam)]);

console.log('\\n=== 3. Object.groupBy ===');
const inventory = [
  { name: 'Apples', category: 'fruit', inStock: true, price: 1.5 },
  { name: 'Bananas', category: 'fruit', inStock: false, price: 0.8 },
  { name: 'Carrots', category: 'veggie', inStock: true, price: 2.0 },
  { name: 'Dates', category: 'fruit', inStock: true, price: 3.5 },
];

const byCategory = Object.groupBy(inventory, item => item.category);
console.log('Grouped by category:', byCategory);

const byStock = Object.groupBy(inventory, item => item.inStock ? 'in-stock' : 'out-of-stock');
console.log('Grouped by stock status:', byStock);

console.log('\\n=== 4. Immutable Array Methods ===');
const numbers = [5, 2, 8, 1, 9];
const sorted = numbers.toSorted((a, b) => a - b);
const withReplaced = sorted.with(0, 999);

console.log('Original numbers (unchanged):', numbers);
console.log('toSorted result:', sorted);
console.log('with(0, 999) result:', withReplaced);

console.log('\\n=== 5. structuredClone() for Deep Copy ===');
const original = { user: 'Narendra', config: { theme: 'dark', retries: 3 } };
const cloned = structuredClone(original);
cloned.config.retries = 99;

console.log('Original retries (unaffected):', original.config.retries);
console.log('Cloned retries:', cloned.config.retries);
`,
  },
  {
    id: 'async-retry',
    label: '🔁 Async Retry with Backoff & Jitter',
    description: 'Resilient network retry pattern with exponential backoff',
    language: 'typescript',
    code: `// 🔁 Async Retry with Exponential Backoff & Full Jitter
// Essential resilience pattern for network calls, external APIs, and rate limits

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
}

async function retryWithBackoff<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 4,
    initialDelayMs = 80,
    maxDelayMs = 1500,
    backoffFactor = 2,
  } = options;

  let attempt = 1;

  while (true) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt > maxRetries) {
        console.error(\`❌ All \${maxRetries} retry attempts failed.\`);
        throw error;
      }

      // Exponential backoff: baseDelay * factor^(attempt - 1)
      const calculatedDelay = Math.min(
        maxDelayMs,
        initialDelayMs * Math.pow(backoffFactor, attempt - 1)
      );

      // Full jitter: random between 0 and calculatedDelay to avoid synchronized spikes
      const jitteredDelay = Math.floor(Math.random() * calculatedDelay);

      console.warn(
        \`⚠️ Attempt \${attempt} failed: "\${(error as Error).message}". Retrying in \${jitteredDelay}ms...\`
      );

      await new Promise(resolve => setTimeout(resolve, jitteredDelay));
      attempt++;
    }
  }
}

// --- Simulation Demo ---
let serverFailures = 0;
const simulateApiCall = async (attempt: number) => {
  serverFailures++;
  console.log(\`[HTTP] Attempt #\${attempt} sending request...\`);
  if (serverFailures < 3) {
    throw new Error('503 Service Unavailable');
  }
  return { status: 200, message: 'Success! Order placed.', orderId: 'ord_42918' };
};

console.log('Initiating resilient request with retry...');
const response = await retryWithBackoff(simulateApiCall, { initialDelayMs: 60 });
console.log('\\n🎉 Request completed successfully:', response);
`,
  },
  {
    id: 'lru-cache',
    label: '🧠 LRU Cache: O(1) Get & Put',
    description: 'Clean Least-Recently-Used cache leveraging JavaScript Map order',
    language: 'typescript',
    code: `// 🧠 LRU (Least Recently Used) Cache
// O(1) get and put operations using JavaScript Map (which guarantees insertion order)

class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, V>;

  constructor(capacity: number) {
    if (capacity <= 0) throw new Error('Capacity must be > 0');
    this.capacity = capacity;
    this.cache = new Map<K, V>();
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;

    // Refresh: delete and re-insert to move key to most recently used position
    const val = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  put(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Evict least recently used (first entry in Map iterator)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
        console.log(\`[EVICTION] Evicted least-recently used key: "\${String(oldestKey)}"\`);
      }
    }
    this.cache.set(key, value);
  }

  snapshot(): Record<string, V> {
    return Object.fromEntries(this.cache.entries());
  }
}

// --- Demo ---
const cache = new LRUCache<string, string>(3);

console.log('1. Adding "A", "B", "C" to cache (capacity: 3):');
cache.put('a', 'Apple');
cache.put('b', 'Banana');
cache.put('c', 'Cherry');
console.log('Cache contents:', cache.snapshot());

console.log('\\n2. Accessing "a" (moves "a" to most recently used):');
cache.get('a');
console.log('Cache contents:', cache.snapshot());

console.log('\\n3. Adding "d" (should evict "b" because "b" is now oldest):');
cache.put('d', 'Date');
console.log('Cache contents:', cache.snapshot());

console.log('\\n4. Probing cache:');
console.log('Has "b"?', cache.get('b') ?? 'Not found (evicted!)');
console.log('Has "a"?', cache.get('a'));
console.log('Has "c"?', cache.get('c'));
console.log('Has "d"?', cache.get('d'));
`,
  },
  {
    id: 'generators-streams',
    label: '⚙️ Generators & Async Iterables',
    description: 'Lazy Fibonacci, pagination streaming with for-await-of, and custom iterables',
    language: 'typescript',
    code: `// ⚙️ Generators & Async Iterables in JavaScript
// Lazy evaluation, memory-efficient streams, and custom iterable objects

// 1. Lazy Fibonacci Generator (infinite, computes on demand)
function* fibonacci() {
  let [prev, curr] = [0, 1];
  while (true) {
    yield curr;
    [prev, curr] = [curr, prev + curr];
  }
}

// Take helper: reads N items from any iterable
function* take<T>(n: number, iterable: Iterable<T>): Generator<T> {
  let count = 0;
  for (const item of iterable) {
    if (count++ >= n) break;
    yield item;
  }
}

console.log('1. First 10 Fibonacci numbers (computed lazily):');
console.log([...take(10, fibonacci())]);

// 2. Async Generator: Paginated API Stream
async function* fetchUserPages(totalPages = 3) {
  for (let page = 1; page <= totalPages; page++) {
    // Simulate API round-trip
    await new Promise(r => setTimeout(r, 60));
    yield {
      page,
      users: [\`User_\${page * 2 - 1}\`, \`User_\${page * 2}\`],
    };
  }
}

console.log('\\n2. Consuming async stream with for-await-of:');
for await (const pageData of fetchUserPages(3)) {
  console.log(\`[PAGE \${pageData.page}]\`, pageData.users);
}

// 3. Custom Iterable Object with Symbol.iterator
const countdown = {
  start: 5,
  [Symbol.iterator]() {
    let current = this.start;
    return {
      next() {
        return current > 0
          ? { done: false, value: current-- }
          : { done: true, value: undefined };
      }
    };
  }
};

console.log('\\n3. Custom countdown iterator spread:');
console.log([...countdown], 'Liftoff! 🚀');
`,
  },
  {
    id: 'array-pipeline',
    label: '🔗 Array Methods & Pipeline',
    description: 'Chained filter, map, reduce operations',
    language: 'typescript',
    code: `// Array Methods & Pipeline Demo
const products = [
  { name: 'Widget', price: 9.99, category: 'tools', inStock: true },
  { name: 'Gadget', price: 29.99, category: 'electronics', inStock: false },
  { name: 'Doohickey', price: 4.99, category: 'tools', inStock: true },
  { name: 'Thingamajig', price: 49.99, category: 'electronics', inStock: true },
  { name: 'Whatchamacallit', price: 14.99, category: 'tools', inStock: true },
];

// Pipeline: in-stock tools, sorted by price, formatted
const result = products
  .filter(p => p.inStock && p.category === 'tools')
  .map(p => ({ ...p, priceFormatted: \`$\${p.price.toFixed(2)}\` }))
  .sort((a, b) => a.price - b.price);

console.log('In-stock tools (sorted by price):');
console.table(result);

// Reduce: total value of in-stock inventory
const totalValue = products
  .filter(p => p.inStock)
  .reduce((sum, p) => sum + p.price, 0);

console.log(\`Total in-stock value: $\${totalValue.toFixed(2)}\`);

// Group by category using Object.groupBy
const grouped = Object.groupBy(products, p => p.category);
console.log('Grouped by category:', grouped);
`,
  },
  {
    id: 'debounce-throttle',
    label: '🎛️ Debounce & Throttle',
    description: 'Implementations with simulated rapid calls',
    language: 'typescript',
    code: `// Debounce & Throttle Implementations

function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      fn(...args);
    }
  };
}

// --- Demo: Simulate rapid calls ---
const results: string[] = [];

const debouncedLog = debounce((msg: unknown) => {
  results.push(\`[DEBOUNCED] \${msg}\`);
}, 100);

const throttledLog = throttle((msg: unknown) => {
  results.push(\`[THROTTLED] \${msg}\`);
}, 100);

// Simulate 5 calls 20ms apart (total 100ms window)
console.log('Simulating 5 rapid calls (20ms apart)...');
await new Promise<void>(resolve => {
  let count = 0;
  const interval = setInterval(() => {
    debouncedLog(\`call #\${count + 1}\`);
    throttledLog(\`call #\${count + 1}\`);
    count++;
    if (count >= 5) {
      clearInterval(interval);
      // Wait for debounce to settle
      setTimeout(() => {
        console.log('\\nResults after 5 calls:');
        results.forEach(r => console.log(' ', r));
        console.log('\\n💡 Notice: Debounce fires ONCE after calls settle.');
        console.log('Throttle fires on FIRST call, then at most once per 100ms window.');
        resolve();
      }, 150);
    }
  }, 20);
});
`,
  },
  {
    id: 'tree-dfs',
    label: '🌲 Binary Search Tree & DFS',
    description: 'Binary search tree with in-order & level-order BFS traversal',
    language: 'typescript',
    code: `// Binary Search Tree with DFS & BFS Traversals

class TreeNode {
  val: number;
  left: TreeNode | null = null;
  right: TreeNode | null = null;
  constructor(val: number) { this.val = val; }
}

class BST {
  root: TreeNode | null = null;

  insert(val: number): this {
    const node = new TreeNode(val);
    if (!this.root) { this.root = node; return this; }

    let curr = this.root;
    while (true) {
      if (val < curr.val) {
        if (!curr.left) { curr.left = node; break; }
        curr = curr.left;
      } else {
        if (!curr.right) { curr.right = node; break; }
        curr = curr.right;
      }
    }
    return this;
  }

  // In-order DFS yields naturally sorted output
  inOrder(node: TreeNode | null = this.root, result: number[] = []): number[] {
    if (!node) return result;
    this.inOrder(node.left, result);
    result.push(node.val);
    this.inOrder(node.right, result);
    return result;
  }

  // Level-order BFS
  levelOrder(): number[][] {
    if (!this.root) return [];
    const result: number[][] = [];
    const queue: TreeNode[] = [this.root];
    while (queue.length) {
      const level: number[] = [];
      const size = queue.length;
      for (let i = 0; i < size; i++) {
        const node = queue.shift()!;
        level.push(node.val);
        if (node.left) queue.push(node.left);
        if (node.right) queue.push(node.right);
      }
      result.push(level);
    }
    return result;
  }

  contains(val: number): boolean {
    let curr = this.root;
    while (curr) {
      if (val === curr.val) return true;
      curr = val < curr.val ? curr.left : curr.right;
    }
    return false;
  }
}

const tree = new BST();
[8, 3, 10, 1, 6, 14, 4, 7, 13].forEach(v => tree.insert(v));

console.log('In-order (sorted):', tree.inOrder());
console.log('Level-order (BFS):', tree.levelOrder());
console.log('Contains 6?', tree.contains(6));
console.log('Contains 5?', tree.contains(5));
`,
  },
  {
    id: 'async-await',
    label: '⏳ Async/Await & Fetch',
    description: 'Top-level await with concurrent fetching and error handling',
    language: 'typescript',
    code: `// Async/Await & Concurrent Fetch Demo
// Uses JSONPlaceholder as a free test API

async function fetchUser(id: number) {
  const res = await fetch(\`https://jsonplaceholder.typicode.com/users/\${id}\`);
  if (!res.ok) throw new Error(\`HTTP \${res.status}: \${res.statusText}\`);
  return res.json();
}

async function fetchPostsByUser(userId: number) {
  const res = await fetch(\`https://jsonplaceholder.typicode.com/posts?userId=\${userId}\`);
  if (!res.ok) throw new Error(\`HTTP \${res.status}: \${res.statusText}\`);
  const posts = await res.json();
  return posts.slice(0, 3); // first 3 posts
}

try {
  console.info('Fetching user and posts concurrently with Promise.all...');

  const [user, posts] = await Promise.all([
    fetchUser(1),
    fetchPostsByUser(1),
  ]);

  console.log('User:', { name: user.name, email: user.email, company: user.company.name });
  console.log('Recent posts:');
  posts.forEach((p: { title: string }, i: number) => {
    console.log(\`  \${i + 1}. \${p.title}\`);
  });

  console.info('All requests succeeded!');
} catch (err) {
  console.error('Fetch failed:', err);
}
`,
  },
  {
    id: 'wasm-add-multiply',
    label: '🔩 WebAssembly — Add & Multiply',
    description: 'Basic WAT module with exported integer functions',
    language: 'wat',
    code: `;; WebAssembly Text Format (WAT)
;; A simple module that exports integer math functions.
;; Hit Run — it compiles to WebAssembly in-browser!

(module
  ;; add: (a: i32, b: i32) -> i32
  (func $add (export "add") (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.add
  )

  ;; multiply: (a: i32, b: i32) -> i32
  (func $multiply (export "multiply") (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.mul
  )

  ;; answer: () -> i32  (returns 42)
  (func $answer (export "answer") (result i32)
    i32.const 42
  )
)`,
  },
  {
    id: 'wasm-fibonacci',
    label: '🔩 WebAssembly — Fibonacci',
    description: 'Recursive Fibonacci in WebAssembly Text Format',
    language: 'wat',
    code: `;; WebAssembly Text Format — Recursive Fibonacci
;; Compiles and executes in-browser via the native WebAssembly API.

(module
  (func $fib (export "fib") (param $n i32) (result i32)
    local.get $n
    i32.const 1
    i32.le_s
    if (result i32)
      local.get $n
    else
      local.get $n
      i32.const 1
      i32.sub
      call $fib

      local.get $n
      i32.const 2
      i32.sub
      call $fib

      i32.add
    end
  )
)`,
  },
];

export const DEFAULT_CODE = `// Welcome to JS Scratchpad ⚡
// Pure JavaScript & TypeScript Playground — Minimal, Fast, Zero Setup
// Press Cmd+Enter (or Ctrl+Enter) to run. Top-level await works out-of-the-box!

const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const analysis = {
  sum: numbers.reduce((acc, n) => acc + n, 0),
  evens: numbers.filter(n => n % 2 === 0),
  squares: numbers.map(n => n ** 2),
};

console.log('Original numbers:', numbers);
console.log('Analysis result:', analysis);
console.info(\`Sum of 1..10 = \${analysis.sum}\`);
`;
