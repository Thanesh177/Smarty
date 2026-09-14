import { useEffect, useState } from 'react';
import { getLearningLibrary, LEARNING_UPDATED } from '../lib/learningJourney';

export default function useLearningLibrary(userId = '') {
  const [snapshot, setSnapshot] = useState(() => ({ userId, items: getLearningLibrary(userId) }));
  useEffect(() => {
    const refresh = () => setSnapshot({ userId, items: getLearningLibrary(userId) });
    refresh();
    const onUpdate = (event) => { if (event.detail?.userId === userId) refresh(); };
    const onStorage = (event) => { if (!event.key || event.key.startsWith('smarty-learning-')) refresh(); };
    window.addEventListener(LEARNING_UPDATED, onUpdate);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(LEARNING_UPDATED, onUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, [userId]);
  return snapshot.userId === userId ? snapshot.items : [];
}
