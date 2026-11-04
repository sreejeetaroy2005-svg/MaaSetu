import { useEffect, useState } from 'react';
import type { Village } from '../data/model';
import { loadWorkspace } from '../offline/repo';

let cache: Village[] | null = null;

/** Villages are tiny and static: one cached read per tab, online or not. */
export function useVillages(): Village[] {
  const [villages, setVillages] = useState<Village[]>(cache ?? []);

  useEffect(() => {
    if (cache) {
      setVillages(cache);
      return;
    }
    let cancelled = false;
    loadWorkspace()
      .then((workspace) => {
        cache = workspace.villages;
        if (!cancelled) setVillages(workspace.villages);
      })
      .catch((error: unknown) => {
        console.error('MaaSetu: could not load villages', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return villages;
}
