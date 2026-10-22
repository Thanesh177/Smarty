import { useEffect } from 'react';
import { deletionPageTitle, renderDeletionContent } from '../lib/deletionPages';
import './AccountDeletion.css';

export default function PublicDeletionPage({ kind }) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${deletionPageTitle(kind)} | Smarty`;
    return () => { document.title = previousTitle; };
  }, [kind]);

  // Trusted, repository-authored markup shared with the standalone HTML pages.
  return <div className="deletion-page" dangerouslySetInnerHTML={{ __html: renderDeletionContent(kind) }} />;
}
