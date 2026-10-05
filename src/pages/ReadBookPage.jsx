import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bookmark, Check, BookOpen, ArrowUpRight, Search, X, RotateCcw, LibraryBig } from 'lucide-react';
import { readBooksApi } from '../api/client';
import useBookLibrary from '../hooks/useBookLibrary';
import { getStarterCatalog } from '../lib/bookStarterCatalog';
import { BOOK_COLLECTIONS, BOOK_LANGUAGES, BOOK_SHELVES, bookAuthor, bookId, bookKey, bookReadId, bookProgress,
  getLegacyLibrary, mergeBookPages, readBookCatalogCache, saveBookCatalogCache, safeBookUrl } from '../lib/bookLibrary';
import './BooksWorkspace.css';

function sourceLink(book) {
  return safeBookUrl(book.previewUrl || book.openLibraryUrl) || (/^\d+$/.test(bookId(book))
    ? `https://www.gutenberg.org/ebooks/${bookId(book)}` : `https://openlibrary.org/works/${encodeURIComponent(bookId(book))}`);
}
function Cover({ book }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const cover = safeBookUrl(book.cover || book.coverUrl);
  useEffect(() => { setFailed(false);setLoaded(false); }, [cover]);
  return <div className="library-cover" aria-hidden="true">
    <span><BookOpen size={24} strokeWidth={1.2} /><strong>{book.title}</strong></span>
    {cover && !failed && <img className={loaded?'is-loaded':''} src={cover} alt="" loading="lazy" decoding="async" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
  </div>;
}
const BookCard = memo(function BookCard({ book, entry, onDetails, onSave, onRead }) {
  return <article className="library-book">
    <button type="button" className="library-cover-button" aria-label={`Details about ${book.title}`} onClick={() => onDetails(book)}><Cover book={book} /></button>
    <div className="library-book-copy">
      <div className="library-book-meta"><span>{entry ? BOOK_SHELVES.find(([key]) => key === entry.shelf)?.[1] : book.readable ? 'Read in Smarty' : 'External preview'}</span>
        <button type="button" className="library-save" aria-label={`${entry ? 'Remove' : 'Save'} ${book.title}${entry ? ' from library' : ' to library'}`}
          aria-pressed={Boolean(entry)} onClick={() => onSave(book)}>{entry ? <Check size={16} /> : <Bookmark size={16} />}</button>
      </div>
      <h3><button type="button" onClick={() => onDetails(book)}>{book.title}</button></h3>
      <p className="library-author">{bookAuthor(book)}</p>
      {book.description && <p className="library-excerpt">{book.description}</p>}
      {entry?.shelf === 'reading' && <div className="library-reading-progress"><span>{entry.totalChapters ? `${bookProgress(entry)}% read · Section ${entry.chapter + 1}` : 'In your reading shelf'}</span>
        {entry.totalChapters > 0 && <progress max="100" value={bookProgress(entry)} aria-label={`${book.title} reading progress`} />}</div>}
      <div className="library-book-actions">{book.readable
        ? <Link onClick={()=>onRead(book)} to={`/read-book/${encodeURIComponent(bookReadId(book))}`}>{entry?.shelf === 'reading' ? 'Continue' : 'Read'}<ArrowUpRight size={14} /></Link>
        : <a href={sourceLink(book)} target="_blank" rel="noopener noreferrer">Preview<ArrowUpRight size={14} /></a>}
        <button type="button" onClick={() => onDetails(book)}>Details</button>
      </div>
    </div>
  </article>;
});

function BookDetails({ book, entry, onClose, onUpdate, onRemove, error, onSimilar }) {
  const ref = useRef(null);
  const [notes, setNotes] = useState(entry?.notes || '');
  useEffect(() => {
    const dialog = ref.current;
    const content = document.querySelector('.app-shell > .content');
    const oldOverflow = content?.style.overflowY;
    if (content) content.style.overflowY = 'hidden';
    dialog.showModal();
    return () => { dialog.close(); if (content) content.style.overflowY = oldOverflow; };
  }, []);
  const subjects = (book.subjects || book.subject || []).filter(item => typeof item === 'string').slice(0, 6);
  return <dialog ref={ref} className="library-dialog" aria-labelledby="library-detail-title" onCancel={onClose}
    onClick={event => { if(event.target === ref.current) { const rect = ref.current.getBoundingClientRect(); if(event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
    <header><span>BOOK DETAILS</span><button type="button" aria-label="Close book details" onClick={onClose} autoFocus><X size={20} /></button></header>
    <div className="library-dialog-body">
      <div className="library-detail-heading"><Cover book={book} /><div><h2 id="library-detail-title">{book.title}</h2><p>{bookAuthor(book)}</p>
        <small>{book.source || 'Library catalog'} · {book.readable ? 'Full-text option in Smarty' : 'Preview at the provider'}</small>
        {book.readable ? <Link className="library-primary" onClick={()=>onUpdate(book,{shelf:'reading'})} to={`/read-book/${encodeURIComponent(bookReadId(book))}`}>Open book<ArrowUpRight size={16} /></Link>
          : <a className="library-primary" href={sourceLink(book)} target="_blank" rel="noopener noreferrer">Open preview<ArrowUpRight size={16} /></a>}
      </div></div>
      <section className="library-detail-section"><h3>About this book</h3><p>{book.description || 'The catalog does not include a description for this edition. Explore its subjects below or visit the source for more detail.'}</p>
        {subjects.length > 0 && <div className="library-subjects">{subjects.map(subject => <button type="button" key={subject} onClick={() => onSimilar(subject.split(' -- ')[0])}>{subject}</button>)}</div>}
      </section>
      <section className="library-detail-section"><label htmlFor="library-shelf">Your reading shelf</label>
        <select id="library-shelf" value={entry?.shelf || ''} onChange={event => event.target.value ? onUpdate(book, { shelf:event.target.value }) : onRemove(book)}>
          <option value="">Not saved</option>{BOOK_SHELVES.map(([value,label]) => <option value={value} key={value}>{label}</option>)}
        </select>
        {entry?.shelf === 'reading' && entry.totalChapters > 0 && <p>Resume at section {entry.chapter + 1} of {entry.totalChapters}.</p>}
      </section>
      <section className="library-detail-section"><label htmlFor="library-notes">Your reading notes</label><p>A useful idea, a question, or something to come back to.</p>
        <textarea id="library-notes" value={notes} maxLength={2000} rows={4} onChange={event => setNotes(event.target.value)} placeholder="What would you like to remember?" />
        <div className="library-notes-footer"><span>{notes.length}/2,000 · {notes === (entry?.notes || '') ? 'on this device' : 'unsaved notes'}</span><button type="button" disabled={notes === (entry?.notes || '')} onClick={() => onUpdate(book, { notes })}>Save notes</button></div>
      </section>
      {error && <p className="library-error" role="alert">{error}</p>}
      <div className="library-detail-footer"><button type="button" onClick={() => onSimilar(subjects[0]?.split(' -- ')[0] || '')}>Find similar books</button><a href={sourceLink(book)} target="_blank" rel="noopener noreferrer">View source<ArrowUpRight size={14} /></a></div>
    </div>
  </dialog>;
}

export default function ReadBookPage() {
  const location = useLocation(), navigate = useNavigate();
  const preview = location.pathname === '/preview-books';
  const initialSearch = new URLSearchParams(location.search).get('search') || '';
  const [query, setQuery] = useState(initialSearch), [debounced, setDebounced] = useState(initialSearch);
  const [collection, setCollection] = useState(''), [language, setLanguage] = useState('en'), [sort, setSort] = useState('popular');
  const [tab, setTab] = useState('explore'), [shelf, setShelf] = useState('all');
  const [catalog, setCatalog] = useState({ books: [], total: 0, nextPage: null });
  const [loading, setLoading] = useState(true), [loadingMore, setLoadingMore] = useState(false), [error, setError] = useState('');
  const [retry, setRetry] = useState(0), [cacheUsed, setCacheUsed] = useState(false), [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');
  const library = useBookLibrary();
  const request = useRef(null), generation = useRef(0), moreBusy = useRef(false), refreshKey = useRef('');
  const legacy = useMemo(() => getLegacyLibrary(), []);
  useEffect(() => { setQuery(new URLSearchParams(location.search).get('search') || ''); }, [location.search]);
  useEffect(() => { const timer = setTimeout(() => setDebounced(query.trim()), 350); return () => clearTimeout(timer); }, [query]);
  const params = useMemo(() => ({search:debounced,category:collection,language:preview?'':language,sort,access:preview?'preview':'read'}), [debounced,collection,language,sort,preview]);
  useEffect(() => {
    if (tab !== 'explore') { request.current?.abort(); generation.current += 1; return; }
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    const ticket = ++generation.current; moreBusy.current = false; setLoadingMore(false); setError('');
    const key = JSON.stringify({...params,page:1}), cached = refreshKey.current === key ? null : readBookCatalogCache(key);
    refreshKey.current = '';
    if (cached) { setCatalog(cached); setCacheUsed(true); setLoading(false); return () => controller.abort(); }
    const starter = getStarterCatalog(params);
    setCatalog(starter); setCacheUsed(false); setLoading(starter.books.length === 0);
    // Let development's effect cleanup run before starting a duplicate request.
    Promise.resolve().then(() => controller.signal.aborted ? null : readBooksApi.getCatalogPage({...params,page:1},{signal:controller.signal})).then(data => {
      if (controller.signal.aborted || generation.current !== ticket) return;
      saveBookCatalogCache(key,data);setCatalog(data);
    }).catch(() => { if(!controller.signal.aborted && generation.current === ticket) setError(starter.books.length ? 'The live catalog is unavailable right now. These starter books and your saved shelves are still available.' : 'The book catalog is unavailable right now. Your saved library is still here.'); })
      .finally(() => { if(!controller.signal.aborted && generation.current === ticket) setLoading(false); });
    return () => controller.abort();
  }, [params,retry,tab]);
  const loadMore = async () => {
    if(moreBusy.current || !catalog.nextPage || loading || query.trim() !== debounced) return;
    moreBusy.current = true; setLoadingMore(true); setError('');
    const controller = new AbortController(); request.current = controller;
    const ticket = generation.current, page = catalog.nextPage, key = JSON.stringify({...params,page});
    try {
      const cached = readBookCatalogCache(key);
      const data = cached || await readBooksApi.getCatalogPage({...params,page},{signal:controller.signal});
      if(controller.signal.aborted || generation.current !== ticket) return;
      if(!cached)saveBookCatalogCache(key,data);
      setCatalog(previous => ({...data,books:mergeBookPages(previous.books,data.books)}));
    } catch { if(!controller.signal.aborted && generation.current === ticket)setError('More books could not load. Try again; your current books are unchanged.'); }
    finally { if(generation.current === ticket) { moreBusy.current=false;setLoadingMore(false); } }
  };
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const refresh = event => {
      if (tab !== 'explore') {
        window.dispatchEvent(new Event('books-info-refresh'));
        event.detail?.waitUntil?.(Promise.resolve()); return;
      }
      request.current?.abort();
      const controller = new AbortController();request.current = controller;
      const ticket = ++generation.current;setError('');setLoadingMore(true);moreBusy.current = true;
      const task = readBooksApi.getCatalogPage({...params,page:1},{signal:controller.signal}).then(data => {
        if(controller.signal.aborted||generation.current!==ticket)return;
        saveBookCatalogCache(JSON.stringify({...params,page:1}),data);setCatalog(data);setCacheUsed(false);setNotice('Library updated.');
      }).catch(()=>{
        if(!controller.signal.aborted&&generation.current===ticket)setError('The catalog could not be updated. Your current books are still available.');
      }).finally(()=>{if(generation.current===ticket){setLoading(false);setLoadingMore(false);moreBusy.current=false;}});
      event.detail?.waitUntil?.(task);
    };
    window.addEventListener('smarty-global-refresh',refresh);
    return()=>window.removeEventListener('smarty-global-refresh',refresh);
  },[tab,params]);
  const entryMap = useMemo(() => new Map(library.entries.map(entry => [bookKey(entry.book),entry])), [library.entries]);
  const filteredLibrary = useMemo(() => {
    const text = query.toLowerCase().trim();
    return library.entries.filter(entry => (shelf === 'all' || entry.shelf === shelf) && (!text || `${entry.book.title} ${bookAuthor(entry.book)} ${entry.notes}`.toLowerCase().includes(text)))
      .sort((a,b) => (b.lastReadAt || b.updatedAt || 0) - (a.lastReadAt || a.updatedAt || 0));
  }, [library.entries,query,shelf]);
  const continueBook = library.entries.filter(entry => entry.shelf === 'reading' && entry.book.readable).sort((a,b)=>(b.lastReadAt||0)-(a.lastReadAt||0))[0];
  const activeCollection = BOOK_COLLECTIONS.find(([key]) => key === collection);
  const toggleSave = book => {
    const exists = entryMap.has(bookKey(book));
    if (exists ? library.remove(book) : library.update(book, {shelf:'want'})) setNotice(`${book.title} ${exists ? 'removed from your library' : 'saved to Want to read'}.`);
  };
  const beginReading = book => library.update(book,{shelf:'reading'});
  const showSimilar = category => { setCollection(category.toLowerCase());setQuery('');setTab('explore');setSelected(null); };
  const count = status => library.entries.filter(entry => entry.shelf === status).length;
  return <main className="books-workspace" aria-labelledby="books-workspace-title">
    <header className="library-header"><div><span className="library-eyebrow"><LibraryBig size={14} /> SMARTY LIBRARY</span><h1 id="books-workspace-title">A little space to read.</h1><p>Follow your curiosity. Keep the ideas that stay with you.</p></div>
      <div className="library-total"><strong>{library.entries.length}</strong><span>on your shelves</span></div>
    </header>
    <div className="library-toolbar"><nav aria-label="Library views">{[['explore','Explore'],['library','My library']].map(([key,label])=><button type="button" key={key} aria-pressed={tab===key} onClick={()=>{setQuery('');setDebounced('');setTab(key);}}>{label}{key==='library'&&library.entries.length>0&&<small>{library.entries.length}</small>}</button>)}</nav>
      <div className="library-search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Search books" placeholder={tab==='library'?'Search your books or notes':'Search titles or authors'} value={query} onChange={event=>setQuery(event.target.value)} />{query&&<button type="button" aria-label="Clear book search" onClick={()=>setQuery('')}><X size={16}/></button>}</div>
    </div>
    {library.error && <p className="library-error" role="alert">{library.error}</p>}
    <p className="library-announcement" role="status" aria-live="polite">{notice}</p>
    {tab==='explore' ? <>
      {!query && !collection && continueBook && <section className="library-resume"><div><span>CONTINUE READING</span><h2>{continueBook.book.title}</h2><p>{bookAuthor(continueBook.book)}{continueBook.totalChapters>0&&` · Section ${continueBook.chapter+1} of ${continueBook.totalChapters}`}</p></div><Link to={`/read-book/${encodeURIComponent(bookReadId(continueBook.book))}`}>Continue<BookOpen size={16}/></Link></section>}
      <div className="library-collections" aria-label="Book collections">{BOOK_COLLECTIONS.map(([key,label])=><button type="button" key={key} aria-pressed={collection===key} onClick={()=>{setCollection(key);setQuery('');}}>{label}</button>)}</div>
      <div className="library-filters"><div className="library-access"><button type="button" aria-pressed={!preview} onClick={()=>navigate('/read-books')}>Read in Smarty</button><button type="button" aria-pressed={preview} onClick={()=>navigate('/preview-books')}>External previews</button></div>
        <div>{!preview&&<label>Language<select aria-label="Book language" value={language} onChange={event=>setLanguage(event.target.value)}>{BOOK_LANGUAGES.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}
        {!preview&&<label>Order<select aria-label="Book order" value={sort} onChange={event=>setSort(event.target.value)}><option value="popular">Popular</option><option value="descending">Recently added</option><option value="ascending">Catalog order</option></select></label>}</div>
      </div>
      <header className="library-section-heading"><div><h2>{query ? `Results for “${query}”` : activeCollection?.[1] || collection}</h2><p>{preview?'These editions open at the provider; full text is not guaranteed.':activeCollection?.[2]||'Explore another direction.'}</p></div>
        {!loading&&<span>{catalog.total.toLocaleString()} {catalog.source==='starter'?'starter picks':'catalog matches'}{cacheUsed?' · cached':''}</span>}
      </header>
      {error&&<div className="library-error-state" role="alert"><p>{error}</p><button type="button" onClick={()=>{if(catalog.books.length&&catalog.source!=='starter')loadMore();else{refreshKey.current=JSON.stringify({...params,page:1});setRetry(value=>value+1);}}}><RotateCcw size={15}/>Try again</button><button type="button" onClick={()=>{setQuery('');setDebounced('');setShelf('all');setTab('library');}}>Open my library</button></div>}
      {loading?<div className="library-skeletons" role="status" aria-label="Loading books">{Array.from({length:8},(_,index)=><div key={index}><span/><i/><i/></div>)}</div>
        : catalog.books.length ? <div className="library-book-grid">{catalog.books.map(book=><BookCard key={bookKey(book)} book={book} entry={entryMap.get(bookKey(book))} onDetails={setSelected} onSave={toggleSave} onRead={beginReading}/>)}</div>
        : !error && <div className="library-empty"><BookOpen size={26}/><h3>No books found in this selection.</h3><p>Try another language, a broader collection, or a title or author name.</p><button type="button" onClick={()=>{setCollection('');setQuery('');setLanguage('en');}}>Reset filters</button></div>}
      {!loading&&catalog.nextPage&&<div className="library-more"><button type="button" disabled={loadingMore||query.trim()!==debounced} onClick={loadMore}>{loadingMore?'Loading more books…':'Show more books'}</button><span>{catalog.books.length} shown · load more at your own pace</span></div>}
    </> : <>
      <div className="library-shelves" aria-label="Reading shelves"><button type="button" aria-pressed={shelf==='all'} onClick={()=>setShelf('all')}>All books<span>{library.entries.length}</span></button>{BOOK_SHELVES.map(([key,label])=><button type="button" key={key} aria-pressed={shelf===key} onClick={()=>setShelf(key)}>{label}<span>{count(key)}</span></button>)}</div>
      <p className="library-local-note">Your shelves, notes, and reading position are saved for this account on this device.</p>
      {legacy.length>0&&library.entries.length===0&&<div className="library-import"><p>There are books saved by the older library on this device. Only import them if they are yours.</p><button type="button" onClick={()=>{if(library.importLegacy())setNotice('Your previous books have been imported.');}}>Import previous books</button></div>}
      {filteredLibrary.length?<div className="library-book-grid">{filteredLibrary.map(entry=><BookCard key={bookKey(entry.book)} book={entry.book} entry={entry} onDetails={setSelected} onSave={toggleSave} onRead={beginReading}/>)}</div>
        : <div className="library-empty"><Bookmark size={26}/><h3>{query?'No matches on your shelves.':'Make this library yours.'}</h3><p>Save a book to read later, track what you are reading, and collect your notes.</p><button type="button" onClick={()=>{setTab('explore');setQuery('');}}>Explore books</button></div>}
    </>}
    <footer className="library-page-footer"><span>Book metadata from {preview?'Open Library':'Gutendex / Project Gutenberg'}. Availability varies; check copyright rules in your country.</span><a href={preview?'https://openlibrary.org':'https://www.gutenberg.org/policy/permission.html'} target="_blank" rel="noopener noreferrer">Source & access<ArrowUpRight size={13}/></a></footer>
    {selected&&<BookDetails key={bookKey(selected)} book={selected} entry={entryMap.get(bookKey(selected))} onClose={()=>setSelected(null)} onUpdate={library.update} onRemove={library.remove} error={library.error} onSimilar={showSimilar}/>}
  </main>;
}
