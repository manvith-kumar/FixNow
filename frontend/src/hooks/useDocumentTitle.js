import { useEffect } from 'react';
export function useDocumentTitle(title) {
  useEffect(() => { document.title = title ? `${title} | FixNow` : 'FixNow - Home repairs with a quote you approve first'; }, [title]);
}
