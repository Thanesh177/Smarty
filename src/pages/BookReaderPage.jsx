import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bookmark, Check, ChevronLeft, ChevronRight, RotateCcw, Search, X, ArrowUpRight } from 'lucide-react';
import { readBooksApi } from '../api/client';
import useBookLibrary from '../hooks/useBookLibrary';
import { bookAuthor, bookKey, bookReadId, readBookLibrary } from '../lib/bookLibrary';
import { STARTER_BOOKS } from '../lib/bookStarterCatalog';
import { bookParagraphs, findBookMatches, normalizeReaderSettings, splitBookSections } from '../lib/bookReader';
import { readBookTextCache, saveBookTextCache, validBookText } from '../lib/bookTextCache';
import './BookReaderPage.css';
import './BooksReaderPolish.css';

function getSettings() {
  try { return normalizeReaderSettings(JSON.parse(localStorage.getItem('reader_settings') || '{}')); }
  catch { return normalizeReaderSettings({}); }
}
function Highlight({ text, query }) {
  const needle = query.trim();
  if (needle.length < 2) return text;
  const result = [], lower = text.toLowerCase();
  let from = 0, at = lower.indexOf(needle.toLowerCase());
  while (at >= 0) {
    result.push(text.slice(from,at),<mark key={at}>{text.slice(at,at+needle.length)}</mark>);
    from = at + needle.length; at = lower.indexOf(needle.toLowerCase(),from);
  }
  result.push(text.slice(from)); return result;
}

export default function BookReaderPage() {
  const { bookId } = useParams(), navigate = useNavigate(), library = useBookLibrary();
  const controllerRef = useRef(null), generation = useRef(0), metaRef = useRef(null), textRef = useRef(null);
  const [settings,setSettings] = useState(getSettings);
  const [data,setData] = useState({ chapters:[], chapter:0, bookmarks:[], title:'', author:'', ready:'' });
  const [loading,setLoading] = useState(true), [refreshing,setRefreshing] = useState(false);
  const [error,setError] = useState(''), [notice,setNotice] = useState(''), [slow,setSlow] = useState(false);
  const [panel,setPanel] = useState(''), [query,setQuery] = useState(''), [searchQuery,setSearchQuery] = useState('');
  const [notes,setNotes] = useState(''), [jump,setJump] = useState(null), [fromCache,setFromCache] = useState(false);
  const [animation,setAnimation] = useState(0);
  const identity = `${library.account}:${bookId}`;
  const ready = data.ready === identity;
  const { chapters, chapter, bookmarks, title, author } = data;

  const loadBook = useCallback(async (fresh = false) => {
    controllerRef.current?.abort();
    const controller = new AbortController(); controllerRef.current = controller;
    const ticket = ++generation.current;
    const valid = () => !controller.signal.aborted && generation.current === ticket;
    setError('');setNotice('');setSlow(false);
    setLoading(true);if (fresh) setRefreshing(true);
    const timer = setTimeout(() => { if(valid()) setSlow(true); },8000);
    const deadline = setTimeout(() => {
      if(!valid())return;
      controller.abort();setLoading(false);setRefreshing(false);setSlow(false);
      setError('The book provider took too long to respond. Try again, or return to the library.');
    },35000);
    try {
      const saved = readBookLibrary(library.account).find(entry => bookReadId(entry.book) === bookId);
      const known = saved?.book || STARTER_BOOKS.find(book => book.id === bookId);
      let metadata = known || { id:bookId, title:`Book #${bookId}` };
      if(valid()) setData(previous => ({...previous,title:metadata.title,author:bookAuthor(metadata)}));
      const cached = await readBookTextCache(bookId);
      if(!valid()) return;
      let text = !fresh ? cached : null, usedCache = Boolean(text);
      if (!text) {
        try {
          text = await readBooksApi.getBookText(bookId,{signal:controller.signal});
          if(!validBookText(text)) throw new Error('This edition does not have readable text available.');
          if(valid()) void saveBookTextCache(bookId,text);
        } catch (failure) {
          if(!valid()) return;
          if(!cached) throw failure;
          text = cached;usedCache = true;
          setNotice('The provider is unavailable. You can keep reading the saved copy.');
        }
      }
      if(!valid()) return;
      const parts = splitBookSections(text);
      metadata = {...metadata,readable:true,gutenberg_id:/^\d+$/.test(bookId)?bookId:'',source:metadata.source||'Library catalog'};
      metaRef.current = metadata;
      const latest = readBookLibrary(library.account).find(entry => bookKey(entry.book) === bookKey(metadata));
      if(!fresh)setNotes(latest?.notes || '');setFromCache(usedCache);
      setData({chapters:parts,chapter:Math.min(Math.max(0,Number(latest?.chapter)||0),parts.length-1),bookmarks:(latest?.bookmarks||[]).filter(value=>value<parts.length),
        title:metadata.title,author:bookAuthor(metadata),ready:identity});
      // Optional metadata must never hold up the text.
      if(!known) readBooksApi.getBookById(bookId,{signal:controller.signal}).then(book=>{
        if(!valid()||!book?.title)return;
        metaRef.current = {...metadata,...book};
        setData(previous=>({...previous,title:book.title,author:bookAuthor(book)}));
      }).catch(()=>{});
    } catch {
      if(valid())setError(navigator.onLine === false ? 'You are offline and this book has not been saved for reading yet.' : 'This book could not be opened. The provider may be busy, or this edition may not have full text.');
    } finally {
      clearTimeout(timer);clearTimeout(deadline);if(valid()){setLoading(false);setRefreshing(false);setSlow(false);}
    }
  },[bookId,identity,library.account]);

  useEffect(()=>{
    setPanel('');setQuery('');setSearchQuery('');setLoading(true);setJump(null);
    let canceled = false;
    Promise.resolve().then(()=>{if(!canceled)void loadBook();});
    return ()=>{canceled=true;generation.current+=1;controllerRef.current?.abort();};
  },[loadBook]);
  useEffect(()=>{
    const refresh = event => { const task=loadBook(true);event.detail?.waitUntil?.(task); };
    window.addEventListener('smarty-global-refresh',refresh);
    return ()=>window.removeEventListener('smarty-global-refresh',refresh);
  },[loadBook]);
  useEffect(()=>{
    if(ready&&chapters.length&&metaRef.current)library.update(metaRef.current,{shelf:'reading',chapter,totalChapters:chapters.length,lastReadAt:Date.now()});
  },[ready,chapter,chapters.length,title,author,library.update]);
  useEffect(()=>{try{localStorage.setItem('reader_settings',JSON.stringify(settings));}catch{}},[settings]);
  useEffect(()=>{const timer=setTimeout(()=>setSearchQuery(query.trim()),250);return()=>clearTimeout(timer);},[query]);
  const paragraphs = useMemo(()=>bookParagraphs(chapters[chapter]),[chapters,chapter]);
  const matches = useMemo(()=>findBookMatches(chapters,searchQuery),[chapters,searchQuery]);
  const words = useMemo(()=>chapters.map(text=>text.split(/\s+/).filter(Boolean).length),[chapters]);
  const minutes = Math.max(1,Math.ceil((words[chapter]||0)/220));
  const progress = chapters.length ? Math.floor(chapter/chapters.length*100) : 0;
  const marked = bookmarks.includes(chapter);
  const entry = library.entries.find(item=>bookReadId(item.book)===bookId);
  const sourceUrl = /^\d+$/.test(bookId) ? `https://www.gutenberg.org/ebooks/${bookId}` : /^OL\d+W$/.test(bookId) ? `https://openlibrary.org/works/${encodeURIComponent(bookId)}` : `https://archive.org/details/${encodeURIComponent(bookId)}`;

  const changeSection = useCallback(next=>{
    const safe = Math.min(Math.max(0,next),chapters.length-1);
    if(safe===chapter)return;
    setData(previous=>({...previous,chapter:safe}));setAnimation(value=>value+1);setJump(null);
    requestAnimationFrame(()=>textRef.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
  },[chapters.length,chapter]);
  useEffect(()=>{
    const keys=event=>{
      if(!ready||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.target.closest('input,textarea,select,button,a,[contenteditable="true"]'))return;
      if(window.getSelection()?.toString())return;
      if(event.key==='ArrowRight'){event.preventDefault();changeSection(chapter+1);}
      if(event.key==='ArrowLeft'){event.preventDefault();changeSection(chapter-1);}
    };
    window.addEventListener('keydown',keys);return()=>window.removeEventListener('keydown',keys);
  },[ready,chapter,changeSection]);
  useEffect(()=>{
    if(jump===null)return;
    const frame=requestAnimationFrame(()=>{
      const paragraph=textRef.current?.querySelector(`[data-paragraph="${jump}"]`);
      paragraph?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
      paragraph?.focus({preventScroll:true});
    });
    return()=>cancelAnimationFrame(frame);
  },[jump,chapter]);
  const toggleBookmark=()=>{
    const next=marked?bookmarks.filter(value=>value!==chapter):[...bookmarks,chapter].sort((a,b)=>a-b);
    if(library.update(metaRef.current,{bookmarks:next}))setData(previous=>({...previous,bookmarks:next}));
  };
  const togglePanel=value=>setPanel(previous=>previous===value?'':value);
  const controls=()=> <div className="reader-controls reader-surface-card">
    <button type="button" disabled={chapter===0} onClick={()=>changeSection(chapter-1)}><ChevronLeft size={16}/>Previous</button>
    <span>Section {chapter+1} of {chapters.length}</span>
    <button type="button" disabled={chapter>=chapters.length-1} onClick={()=>changeSection(chapter+1)}>Next<ChevronRight size={16}/></button>
  </div>;

  if((loading&&!ready)||error&&!ready)return <section className="reader-page reader-theme-dark reader-opening">
    <div className="reader-container"><Link className="reader-library-link" to="/read-books">Library</Link>
      <div className="reader-opening-copy" role={error?'alert':'status'} aria-live="polite">
        {!error&&<div className="reader-loading-book" aria-hidden="true"><span/><span/><span/></div>}
        <span className="reader-kicker">{error?'BOOK UNAVAILABLE':'SETTLE INTO A GOOD BOOK'}</span><h1>{title||'Your next chapter'}</h1>
        <p>{error|| (slow?'The provider is taking a little longer. Your reading place is safe.':'Preparing your pages. We’ll pick up where you left off.')}</p>
        {!error&&<div className="reader-text-skeleton" aria-hidden="true">{Array.from({length:6},(_,i)=><i key={i}/>)}</div>}
        {error&&<button type="button" onClick={()=>loadBook(true)}><RotateCcw size={16}/>Try again</button>}
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer">View source<ArrowUpRight size={14}/></a>
      </div>
    </div>
  </section>;

  return <section className={`reader-page reader-theme-${settings.theme}`} data-reading="true">
    <div className="reader-container">
      <div className="reader-topbar reader-surface-card">
        <Link className="reader-library-link" to="/read-books">Library</Link>
        <div className="reader-progress-text"><strong>{title}</strong><span>{progress}% read · Section {chapter+1} of {chapters.length}</span></div>
        <div className="reader-tools"><button type="button" aria-label="Reader settings" aria-expanded={panel==='settings'} aria-controls="reader-panel" onClick={()=>togglePanel('settings')}>Aa</button>
          <button type="button" aria-label="Find in book" aria-expanded={panel==='search'} onClick={()=>togglePanel('search')}><Search size={18}/></button>
          <button type="button" aria-label={marked?'Remove section bookmark':'Bookmark this section'} aria-pressed={marked} onClick={toggleBookmark}>{marked?<Check size={18}/>:<Bookmark size={18}/>}</button></div>
      </div>
      <header className="reader-hero-card"><div className="reader-hero-copy"><p className="reader-kicker">{author}</p><h1>{title}</h1><p>Section {chapter+1} · About {minutes} min to read{fromCache?' · Saved text':''}</p></div></header>
      {(notice||refreshing||error||library.error)&&<p className="reader-status" role="status">{library.error||error||notice||(slow?'Still updating. Your current section is available.':'Updating the text without losing your place…')}</p>}
      {panel&&<section className="reader-menu reader-surface-card" id="reader-panel" aria-label={panel==='search'?'Find in book':'Reading settings'}>
        <div className="reader-panel-heading"><h2>{panel==='search'?'Find in this book':'Make yourself comfortable'}</h2><button type="button" aria-label="Close reader panel" onClick={()=>setPanel('')}><X size={18}/></button></div>
        {panel==='settings'?<>
          <div className="menu-row">{['dark','sepia','light'].map(theme=><button type="button" key={theme} aria-pressed={settings.theme===theme} onClick={()=>setSettings(value=>({...value,theme}))}>{theme[0].toUpperCase()+theme.slice(1)}</button>)}</div>
          <div className="menu-group"><button type="button" aria-label="Decrease text size" disabled={settings.fontSize<=14} onClick={()=>setSettings(value=>({...value,fontSize:value.fontSize-1}))}>A−</button><span>{settings.fontSize}px</span><button type="button" aria-label="Increase text size" disabled={settings.fontSize>=28} onClick={()=>setSettings(value=>({...value,fontSize:value.fontSize+1}))}>A+</button></div>
          <label className="reader-field">Line spacing<input aria-label="Line spacing" type="range" min="1.4" max="2.4" step="0.1" value={settings.lineHeight} onChange={event=>setSettings(value=>({...value,lineHeight:Number(event.target.value)}))}/></label>
          <label className="reader-field">Go to section<select aria-label="Go to section" value={chapter} onChange={event=>changeSection(Number(event.target.value))}>{chapters.map((text,i)=><option key={i} value={i}>Section {i+1} · {text.trim().split('\n')[0].slice(0,60)}</option>)}</select></label>
          <label className="reader-field">Reading notes<textarea aria-label="Reading notes" rows={3} maxLength={2000} value={notes} onChange={event=>setNotes(event.target.value)} placeholder="An idea to keep, or a question to explore"/></label>
          <div className="reader-note-actions"><span>{notes.length}/2,000 · {notes===(entry?.notes||'')?'saved on this device':'unsaved'}</span><button type="button" disabled={notes===(entry?.notes||'')} onClick={()=>{if(library.update(metaRef.current,{notes}))setNotice('Reading notes saved.');}}>Save notes</button></div>
          <button type="button" disabled={refreshing} onClick={()=>loadBook(true)}><RotateCcw size={15}/>Update book text</button>
        </>:<>
          <label className="reader-field">Search the full text<input type="search" autoFocus value={query} maxLength={120} onChange={event=>setQuery(event.target.value)} placeholder="Find a name, idea, or phrase"/></label>
          <p className="reader-search-status" role="status">{searchQuery.length<2?'Enter at least two characters.':matches.length?`${matches.length===60?'First 60':matches.length} matching passages`:'No matching passages.'}</p>
          <div className="reader-search-results">{matches.map(match=><button type="button" key={`${match.section}:${match.paragraph}`} onClick={()=>{
            setData(previous=>({...previous,chapter:match.section}));setJump(match.paragraph);setPanel('');setAnimation(value=>value+1);
          }}><small>Section {match.section+1}</small><span><Highlight text={match.excerpt} query={searchQuery}/></span></button>)}</div>
        </>}
      </section>}
      <div className="reader-progress" role="progressbar" aria-label="Book progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div style={{width:`${progress}%`}}/></div>
      {controls()}
      {bookmarks.length>0&&<div className="bookmark-list"><strong>Saved sections</strong><div>{bookmarks.map(value=><button type="button" key={value} aria-pressed={value===chapter} onClick={()=>changeSection(value)}>Section {value+1}</button>)}</div></div>}
      <article ref={textRef} key={animation} className="reader-content reader-surface-card reader-section-enter" aria-label={`Section ${chapter+1}`} style={{fontSize:`${settings.fontSize}px`,lineHeight:settings.lineHeight}}>
        {paragraphs.map((text,index)=><p data-paragraph={index} tabIndex={-1} key={index}><Highlight text={text} query={searchQuery}/></p>)}
      </article>
      {controls()}
      {chapter===chapters.length-1&&<section className="reader-finish"><h2>Keep the idea. Find your next read.</h2><p>Move this book to your finished shelf, then explore something related.</p>
        <button type="button" onClick={()=>{if(library.update(metaRef.current,{shelf:'finished',finishedAt:Date.now()}))navigate('/booksinfo');}}>Mark as finished</button>
        <Link to={`/read-books?search=${encodeURIComponent(author)}`}>More by this author</Link></section>}
    </div>
  </section>;
}
