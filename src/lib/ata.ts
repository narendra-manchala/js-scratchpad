import * as monaco from 'monaco-editor';

const fetchedPkgs = new Set<string>();

export type AtaState = {
  status: 'idle' | 'fetching' | 'loaded' | 'error';
  pkg?: string;
};

type AtaListener = (state: AtaState) => void;
const listeners = new Set<AtaListener>();

export function subscribeAta(listener: AtaListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyAta(state: AtaState) {
  listeners.forEach(fn => fn(state));
}

let idleTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Parses code for ES6 imports, fetches their types from esm.sh,
 * and injects them into Monaco editor for IntelliSense.
 */
export async function acquireTypes(code: string) {
  // Extract all imported package names
  const importRegex = /import\s+(?:[\w*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/g;
  const pkgs = new Set<string>();
  
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    let pkg = match[1];
    // Ignore relative imports and http imports 
    if (!pkg.startsWith('.') && !pkg.startsWith('/') && !pkg.startsWith('http')) {
      pkgs.add(pkg);
    }
  }

  for (const pkg of pkgs) {
    if (fetchedPkgs.has(pkg)) continue;
    fetchedPkgs.add(pkg);

    if (idleTimer) clearTimeout(idleTimer);
    notifyAta({ status: 'fetching', pkg });

    try {
      // 1. Fetch package from esm.sh to get the types header
      const res = await fetch(`https://esm.sh/${pkg}`);
      const typeUrl = res.headers.get('x-typescript-types');

      if (typeUrl) {
        // 2. Fetch the actual type declaration file
        const typesRes = await fetch(typeUrl);
        let typesContent = await typesRes.text();

        // esm.sh bundles types, but sometimes they still have relative exports
        // We do a simple inject
        const libUri = `file:///node_modules/${pkg}/index.d.ts`;
        
        // Define module explicitly if it doesn't declare module
        if (!typesContent.includes(`declare module "${pkg}"`)) {
          typesContent = `declare module "${pkg}" {\n${typesContent}\n}`;
        }

        (monaco.languages.typescript as any).javascriptDefaults.addExtraLib(typesContent, libUri);
        (monaco.languages.typescript as any).typescriptDefaults.addExtraLib(typesContent, libUri);
        
        console.log(`[ATA] Loaded types for ${pkg}`);
        notifyAta({ status: 'loaded', pkg });

        idleTimer = setTimeout(() => {
          notifyAta({ status: 'idle' });
        }, 3000);
      } else {
        console.warn(`[ATA] No types found for ${pkg}`);
        notifyAta({ status: 'idle' });
      }
    } catch (e) {
      console.error(`[ATA] Failed to fetch types for ${pkg}`, e);
      notifyAta({ status: 'error', pkg });
      idleTimer = setTimeout(() => {
        notifyAta({ status: 'idle' });
      }, 3000);
    }
  }
}

