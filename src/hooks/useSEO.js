import { useEffect } from 'react';
import { updateSEO, resetSEO } from '../utils/seo';

export const useSEO = (opts) => {
  useEffect(() => {
    updateSEO(opts);
    return resetSEO;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
