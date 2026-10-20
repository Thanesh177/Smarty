import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, ArrowUpRight, Bookmark, Share2, Type, X } from 'lucide-react';
import { NewsStoryLink } from './NewsStoryLinks';
import { NewsFollowButton } from './NewsPersonalization';
import { safeNewsUrl } from '../lib/newsEdition';
import { newsPreviewParagraphs } from '../lib/newsReader';
import './NewsReader.css';

function publicationDate(value) {
  const time = new Date(value);
  if (!value || !Number.isFinite(time.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(time);
}

export default function NewsReader({ article, saved, context, nextReports = [], comfortableText, status,
  onToggleText, onToggleSave, onShare, onOpen, onClose, returnFocusRef }) {
  const dialogRef = useRef(null), headingRef = useRef(null), bodyRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const id = useId();
  const url = safeNewsUrl(article.news_link);
  const date = publicationDate(article.published_at);
  const paragraphs = newsPreviewParagraphs(article);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      const target = previousFocus?.isConnected ? previousFocus : returnFocusRef?.current;
      target?.focus?.({ preventScroll: true });
    };
  }, [returnFocusRef]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    headingRef.current?.focus({ preventScroll: true });
  }, [article.news_link]);

  return createPortal(<dialog className={`news-reader${comfortableText ? ' news-reader--large' : ''}`} ref={dialogRef}
    aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); closeRef.current(); }}
    onClick={event => { if (event.target === event.currentTarget) closeRef.current(); }}>
    <div className="news-reader-sheet">
      <header className="news-reader-bar"><span>Quick read</span><div>
        <button type="button" aria-pressed={comfortableText} aria-label="Larger reading text" onClick={onToggleText}><Type size={18} aria-hidden="true" /></button>
        <button type="button" aria-label="Close quick read" onClick={onClose}><X size={20} aria-hidden="true" /></button>
      </div></header>
      <div className="news-reader-scroll" ref={bodyRef}>
        <article className="news-reader-article">
          <span className="news-reader-section">{article.section || 'News'}</span>
          <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1}>{article.title}</h2>
          <div className="news-reader-byline"><strong>{article.source || 'Original report'}</strong>
            {date && <time dateTime={article.published_at}>{date}</time>}</div>
          {paragraphs.length > 0 && <div className="news-reader-prose">{paragraphs.map((text, index) => <p key={index}>{text}</p>)}</div>}
          {!paragraphs.length && context && <div className="news-reader-context-lead"><span>From the daily briefing · AI-assisted</span><div className="news-reader-prose"><p>{context.summary}</p></div></div>}
          <p className="news-reader-disclosure">{paragraphs.length || context ? 'A discovery preview, not the full article. Check the publisher for details and subsequent corrections.' : 'The publisher hasn’t supplied a summary. Read the original report for the full story.'}</p>
          <div className="news-reader-report-actions">
            <a className="news-reader-original" href={url} target="_blank" rel="noopener noreferrer">Read original report <ArrowUpRight size={16} aria-hidden="true" /></a>
            <button type="button" aria-pressed={saved} onClick={() => onToggleSave(article)}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />{saved ? 'Saved' : 'Save'}</button>
            <button type="button" onClick={() => onShare(article)}><Share2 size={16} aria-hidden="true" />Share</button>
          </div>
          {paragraphs.length > 0 && context && <aside className="news-reader-context" aria-label="Context from the daily briefing">
            <span>In the daily briefing</span><h3>{context.title}</h3><p>{context.summary}</p>
            <small>AI-assisted synthesis of linked reporting. Verify important details with the original sources.</small>
          </aside>}
          {status && <p className="news-reader-disclosure" role="status">{status}</p>}
          <section className="news-reader-follow" aria-label="Explore this story">
            <h3>See how the story unfolds</h3><p>Explore available earlier coverage, or follow the subject for future reports.</p>
            <div><NewsStoryLink story={article} /><NewsFollowButton story={article} /></div>
          </section>
          {nextReports.length > 0 && <section className="news-reader-next" aria-label={`More in ${article.section || 'news'}`}>
            <h3>More in {article.section || 'news'}</h3>
            {nextReports.map(report => <button type="button" key={report.news_link} onClick={() => onOpen(report)}>
              <span><strong>{report.title}</strong><small>{report.source || 'Original report'}</small></span><ArrowRight size={18} aria-hidden="true" />
            </button>)}
          </section>}
        </article>
      </div>
    </div>
  </dialog>, document.body);
}
