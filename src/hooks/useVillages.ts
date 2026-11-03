import { useEffect, useState } from 'react';
import type { Village } from '../data/model';
import { listVillages } from '../services/journeyService';

let cache: Village[] | null = null;

/** Villages are tiny and static in the prototype: read them once per tab. */
export function useVillages(): Village[] {
  const [villages, setVillages] = useState<Village[]>(cache ?? []);

  useEffect(() => {
    if (cache) {
      setVillages(cache);
      return;
    }
    let cancelled = false;
    listVillages()
      .then((next) => {
        cache = next;
        if (!cancelled) setVillages(next);
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
