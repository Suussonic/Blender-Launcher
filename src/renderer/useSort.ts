import { useState } from 'react';

export type SortDir = 'asc' | 'desc';

export default function useSort(initialField: string | null = null, initialDir: SortDir = 'asc') {
  const [field, setField] = useState<string | null>(initialField);
  const [dir, setDir] = useState<SortDir>(initialDir);

  const toggle = (f: string) => {
    setField((prev) => {
      if (prev === f) {
        setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setDir('asc');
      return f;
    });
  };

  return { field, dir, toggle, setField, setDir } as const;
}
