/**
 * backup.js — Export and import all ss_* localStorage keys as a JSON backup file.
 */

const SS_PREFIX = 'ss_';

/**
 * Export all localStorage keys that start with "ss_" to a downloadable JSON file.
 * The filename includes the current date for easy identification.
 */
export function exportBackup() {
  try {
    const backup = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(SS_PREFIX)) {
        try {
          backup[key] = JSON.parse(localStorage.getItem(key));
        } catch {
          // Store raw string if not valid JSON
          backup[key] = localStorage.getItem(key);
        }
      }
    }

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    a.href = url;
    a.download = `salestew-backup-${date}.json`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (err) {
    console.error('[backup] Export failed:', err);
    throw new Error('Backup export failed: ' + err.message);
  }
}

/**
 * Import a backup JSON file and restore all contained keys to localStorage.
 * Only keys that start with "ss_" are restored; others are ignored for safety.
 * @param {File} file - A File object (from a file input element)
 * @returns {Promise<{ restored: number, skipped: number }>}
 */
export async function importBackup(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No file provided.'));
    }
    if (!file.name.endsWith('.json')) {
      return reject(new Error('File must be a .json backup file.'));
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
          return reject(new Error('Invalid backup format.'));
        }

        let restored = 0;
        let skipped = 0;

        for (const [key, value] of Object.entries(data)) {
          if (!key.startsWith(SS_PREFIX)) {
            skipped++;
            continue;
          }
          try {
            localStorage.setItem(
              key,
              typeof value === 'string' ? value : JSON.stringify(value)
            );
            restored++;
          } catch (storageErr) {
            console.warn(`[backup] Could not restore key "${key}":`, storageErr);
            skipped++;
          }
        }

        resolve({ restored, skipped });
      } catch (parseErr) {
        reject(new Error('Failed to parse backup file: ' + parseErr.message));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file.'));
    };

    reader.readAsText(file, 'utf-8');
  });
}
