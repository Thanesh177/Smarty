import { useEffect, useState } from 'react';
import { verifyPostGlossary } from '../lib/postGlossary';
import { subscribePostVocabulary } from '../lib/postVocabularyEvents';

const EMPTY_TERMS = [];

export default function usePostVocabulary(post) {
  const glossary = post?.postGlossary, title = post?.title, body = post?.body;
  const postId = String(post?.id || post?.postId || post?.reelId || '');
  const [verified, setVerified] = useState(null);
  useEffect(() => {
    let active = true, eventRevision = 0, acceptedEvent = 0;
    const check = async (candidate, initial = false) => {
      const request = initial ? 0 : ++eventRevision;
      try {
        const value = await verifyPostGlossary({ title, body, postGlossary: candidate });
        if (active && value && (initial ? acceptedEvent === 0 : request >= acceptedEvent)) {
          if (!initial) acceptedEvent = request;
          setVerified({ glossary, postId, title, body, terms: value.terms });
        } else if (active && initial && !value && acceptedEvent === 0) setVerified(null);
      } catch { if (active && initial && acceptedEvent === 0) setVerified(null); }
    };
    const unsubscribe = subscribePostVocabulary(postId, candidate => { void check(candidate); });
    if (glossary) void check(glossary, true);
    else setVerified(null);
    return () => { active = false; unsubscribe(); };
  }, [glossary, postId, title, body]);
  return verified && verified.glossary === glossary && verified.postId === postId && verified.title === title && verified.body === body ? verified.terms : EMPTY_TERMS;
}
