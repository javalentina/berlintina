// File uploads on a plain directory, shaped like the slice of supabase.storage
// the server used.
//
// Artists upload photos with their submissions. Those files used to live in a
// Supabase bucket and were referenced by absolute URLs; they now live on a disk
// that Railway mounts into the container, and are served by our own Express under
// /media. Keeping the same method names means the upload handlers stay unchanged.
//
// URLs are returned relative on purpose: the site answers on berlintina.de and on
// Railway's preview hostnames, and a relative path is correct on all of them — and
// survives the next move too.

import { mkdir, writeFile, stat } from 'node:fs/promises';
import { join, normalize, dirname } from 'node:path';

const PUBLIC_PREFIX = '/media';

// A filename comes from user input, so it must not be able to climb out of the
// bucket directory or hide traversal inside a subdirectory.
function safePath(name) {
  const cleaned = normalize(String(name)).replace(/^(\.\.(\/|\\|$))+/, '');
  if (cleaned.includes('..') || cleaned.startsWith('/') || cleaned.startsWith('\\')) {
    throw new Error(`storage: unsafe filename ${JSON.stringify(name)}`);
  }
  return cleaned;
}

export function createStorage(rootDir) {
  const root = rootDir;

  return {
    // Kept so the existing startup call still works; a directory needs no creating
    // ceremony, but the caller should not have to know that.
    async createBucket(bucket) {
      await mkdir(join(root, safePath(bucket)), { recursive: true });
    },

    from(bucket) {
      const bucketDir = join(root, safePath(bucket));

      return {
        async upload(filename, body, options = {}) {
          try {
            const relative = safePath(filename);
            const target = join(bucketDir, relative);

            if (options.upsert === false) {
              const exists = await stat(target).then(() => true, () => false);
              if (exists) {
                return { data: null, error: { message: 'file already exists' } };
              }
            }

            await mkdir(dirname(target), { recursive: true });
            await writeFile(target, body);
            return { data: { path: relative }, error: null };
          } catch (err) {
            return { data: null, error: { message: err.message } };
          }
        },

        getPublicUrl(path) {
          const relative = safePath(path);
          return { data: { publicUrl: `${PUBLIC_PREFIX}/${bucket}/${relative}` } };
        },
      };
    },

    // Where Express should mount the static handler, and from which directory.
    publicPrefix: PUBLIC_PREFIX,
    rootDir: root,
  };
}
