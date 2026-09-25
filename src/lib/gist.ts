import type { ScFile } from './files';

export async function exportToGist(files: ScFile[], token: string): Promise<string> {
  if (!token) throw new Error('GitHub token is required to create a Gist');

  const gistFiles: Record<string, { content: string }> = {};
  files.forEach(f => {
    gistFiles[f.name] = { content: f.code || '// Empty file' };
  });

  const response = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      description: 'Exported from JS Scratchpad',
      public: false,
      files: gistFiles
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(err.message || 'Failed to create Gist');
  }

  const data = await response.json();
  return data.html_url;
}
