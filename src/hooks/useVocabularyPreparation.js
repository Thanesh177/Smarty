import { useEffect } from 'react';
import { postVocabularyPublisher } from '../api/client';

export default function useVocabularyPreparation(user, loading) {
  const account = loading ? '' : String(user?.sub || user?.userId || user?.id || '');
  useEffect(() => {
    postVocabularyPublisher.activate(account);
    const resume = () => postVocabularyPublisher.resume();
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
      postVocabularyPublisher.deactivate();
    };
  }, [account]);
}
