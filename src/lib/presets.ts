export interface CodePreset {
  id: string;
  label: string;
  description: string;
  code: string;
}

export const PRESETS: CodePreset[] = [
  {
    id: 'array-pipeline',
    label: '🔗 Array Methods & Pipeline',
    description: 'Chained filter, map, reduce operations',
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

// Group by category using Object.groupBy (or manual reduce)
const grouped = products.reduce((acc, p) => {
  acc[p.category] ??= [];
  acc[p.category].push(p.name);
  return acc;
}, {} as Record<string, string[]>);

console.log('Grouped by category:', grouped);
`,
  },
  {
    id: 'async-await',
    label: '⏳ Async/Await & Fetch',
    description: 'Top-level await with error handling',
    code: `// Async/Await & Fetch Demo
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

// Top-level await — runs directly!
try {
  console.info('Fetching user and posts concurrently...');
  
  const [user, posts] = await Promise.all([
    fetchUser(1),
    fetchPostsByUser(1),
  ]);
  
  console.log('User:', { name: user.name, email: user.email, company: user.company.name });
  console.log('Recent posts:');
  posts.forEach((p: { title: string; body: string }, i: number) => {
    console.log(\`  \${i + 1}. \${p.title}\`);
  });
  
  console.info('Done!');
} catch (err) {
  console.error('Fetch failed:', err);
}
`,
  },
  {
    id: 'tree-dfs',
    label: '🌲 Data Structures / Tree DFS',
    description: 'Binary search tree with DFS traversal',
    code: `// Binary Search Tree with DFS Traversal

class TreeNode {
  val: number;
  left: TreeNode | null = null;
  right: TreeNode | null = null;
  
  constructor(val: number) {
    this.val = val;
  }
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
  
  // In-order DFS → sorted output
  inOrder(node: TreeNode | null = this.root, result: number[] = []): number[] {
    if (!node) return result;
    this.inOrder(node.left, result);
    result.push(node.val);
    this.inOrder(node.right, result);
    return result;
  }
  
  // Level-order BFS for visualization
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

// Flatten tree levels into a visual string
const levels = tree.levelOrder();
console.log('\\nTree structure:');
levels.forEach((level, i) => {
  const indent = ' '.repeat((levels.length - i) * 2);
  console.log(indent + level.join('   '));
});
`,
  },
  {
    id: 'debounce-throttle',
    label: '🎛️ Debounce / Throttle',
    description: 'Implementations with usage demo',
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
        console.log('Results after 5 calls:');
        results.forEach(r => console.log(' ', r));
        console.log('\\nNote: debounce fires ONCE (after last call settles)');
        console.log('Throttle fires on FIRST call, then at most once per limit window');
        resolve();
      }, 200);
    }
  }, 20);
});

// Show type signatures
console.log('\\nType-safe signature examples:');
const typed = debounce((x: number, y: string) => console.log(x, y), 50);
console.log('debounce<(x: number, y: string) => void>:', typed.toString().slice(0, 60) + '...');
`,
  },
];

export const DEFAULT_CODE = `// Welcome to JS Scratchpad ⚡
// Press Cmd+Enter (or Ctrl+Enter) to run your code.
// Top-level await is supported!

const nums = Array.from({ length: 10 }, (_, i) => i + 1);

const result = {
  sum: nums.reduce((a, b) => a + b, 0),
  squares: nums.map(n => n ** 2),
  evens: nums.filter(n => n % 2 === 0),
};

console.log('Numbers:', nums);
console.log('Result:', result);
console.info(\`Sum of 1–10 = \${result.sum}\`);
`;
