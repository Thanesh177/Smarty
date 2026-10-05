import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Bookmark, Search, RotateCcw, X, Play } from 'lucide-react';
import { postApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { contentId, contentList, contentTopics, filterContent } from '../lib/communityContent';
import './SavedPage.css';
import './CommunityWorkspace.css';

function SavedCard({post,busy,onOpen,onRemove}) {
  const [failed,setFailed]=useState(false);
  const image=post.imageUrl||post.photoUrl||post.thumbnail||post.coverImage||post.image||'';
  const id=contentId(post),title=post.title||'Saved idea';
  return <article className="saved-card">
    <button type="button" className="saved-card-media" aria-label={`Read ${title}`} onClick={()=>onOpen(id)}>
      {typeof image==='string'&&image&&!failed?<img src={image} alt="" loading="lazy" decoding="async" onError={()=>setFailed(true)}/>:<div className="saved-placeholder"><Bookmark size={28} strokeWidth={1}/><span>{contentTopics(post)[0]||'An idea to keep'}</span></div>}
      {post.videoUrl&&<span className="saved-video-label"><Play size={12}/>Video</span>}
    </button>
    <div className="saved-card-body"><span className="saved-topic">{contentTopics(post).join(' · ')||'Smarty'}</span>
      <button type="button" className="saved-title-btn" onClick={()=>onOpen(id)}>{title}</button>
      <p>{post.body||post.description||'Open this saved post to pick up the idea.'}</p>
      <div className="saved-card-actions"><button type="button" onClick={()=>onOpen(id)}>Read<ArrowUpRight size={15}/></button>
        <button type="button" className="saved-remove" disabled={busy} aria-label={`Remove ${title} from saved`} onClick={()=>onRemove(post)}><Bookmark size={16} fill="currentColor"/>{busy?'Removing…':'Saved'}</button></div>
    </div>
  </article>;
}
export default function SavedPage() {
  const navigate=useNavigate(),{user}=useAuth();
  const account=String(user?.sub||user?.id||user?.userId||'guest');
  const [state,setState]=useState({account,posts:[]});
  const posts=state.account===account?state.posts:[];
  const [query,setQuery]=useState(''),[topic,setTopic]=useState('All'),[sort,setSort]=useState('recent');
  const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState('');
  const [busy,setBusy]=useState(''),[notice,setNotice]=useState(''),[removed,setRemoved]=useState(null);
  const mounted=useRef(false),generation=useRef(0),mutation=useRef(false);
  const load=useCallback(async(silent=false)=>{
    if(mutation.current)return;
    const ticket=++generation.current;
    setError('');silent?setRefreshing(true):setLoading(true);
    try{
      const result=await postApi.getSavedReels();
      if(mounted.current&&ticket===generation.current)setState({account,posts:contentList(result)});
    }catch(failure){
      if(mounted.current&&ticket===generation.current)setError(failure?.response?.status===401?'Sign in to see your saved posts.':'Saved posts could not be updated. Please try again.');
    }finally{if(mounted.current&&ticket===generation.current){setLoading(false);setRefreshing(false);}}
  },[account]);
  useEffect(()=>{
    mounted.current=true;mutation.current=false;setBusy('');setRemoved(null);setNotice('');setQuery('');setTopic('All');
    let canceled=false;Promise.resolve().then(()=>{if(!canceled)void load();});
    return()=>{canceled=true;mounted.current=false;generation.current++;};
  },[load]);
  useEffect(()=>{
    const refresh=event=>event.detail?.waitUntil?.(load(true));
    window.addEventListener('smarty-global-refresh',refresh);
    return()=>window.removeEventListener('smarty-global-refresh',refresh);
  },[load]);
  const topics=useMemo(()=>['All',...[...new Set(posts.flatMap(contentTopics))].sort()], [posts]);
  useEffect(()=>{if(!loading&&!topics.includes(topic))setTopic('All');},[loading,topics,topic]);
  const filtered=useMemo(()=>filterContent(posts,{query,topic,sort}),[posts,query,topic,sort]);
  const remove=async post=>{
    if(mutation.current)return;mutation.current=true;setBusy(contentId(post));setNotice('');
    const ticket=generation.current;
    try{
      const result=await postApi.toggleSave(contentId(post));if(result?.success===false)throw new Error('Bookmark update was not accepted.');
      if(!mounted.current||ticket!==generation.current)return;
      setState(previous=>({...previous,posts:previous.posts.filter(item=>contentId(item)!==contentId(post))}));setRemoved(post);setNotice('Removed from saved.');
      window.dispatchEvent(new Event('saved-posts-updated'));
    }catch{if(mounted.current&&ticket===generation.current)setNotice('This bookmark could not be removed. Try again.');}
    finally{if(ticket===generation.current){mutation.current=false;if(mounted.current)setBusy('');}}
  };
  const undo=async()=>{
    if(!removed||mutation.current)return;const post=removed;mutation.current=true;setBusy(contentId(post));
    const ticket=generation.current;
    try{
      const result=await postApi.toggleSave(contentId(post));if(result?.success===false)throw new Error('Bookmark update was not accepted.');
      if(!mounted.current||ticket!==generation.current)return;
      setState(previous=>({...previous,posts:contentList([post,...previous.posts])}));setRemoved(null);setNotice('Bookmark restored.');
      window.dispatchEvent(new Event('saved-posts-updated'));
    }catch{if(mounted.current&&ticket===generation.current)setNotice('The bookmark could not be restored. Try again.');}
    finally{if(ticket===generation.current){mutation.current=false;if(mounted.current)setBusy('');}}
  };
  const reset=()=>{setQuery('');setTopic('All');};
  return <main className="saved-page community-workspace" aria-labelledby="saved-page-title">
    <header className="community-page-heading"><div><span className="community-eyebrow">YOUR COLLECTION</span><h1 id="saved-page-title">Saved for a quieter moment.</h1><p>Pick up an idea, follow a thread, or find something worth reading again.</p></div>
      <button type="button" className="community-icon-button" aria-label="Refresh saved posts" disabled={loading||refreshing||Boolean(busy)} onClick={()=>load(true)}><RotateCcw size={18}/></button></header>
    <div className="community-toolbar"><div className="community-search"><Search size={17} aria-hidden="true"/><input type="search" aria-label="Search saved posts" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find an idea you saved"/>{query&&<button type="button" aria-label="Clear saved search" onClick={()=>setQuery('')}><X size={17}/></button>}</div>
      <label className="community-sort">Order<select aria-label="Saved post order" value={sort} onChange={event=>setSort(event.target.value)}><option value="recent">Recent first</option><option value="title">Title A–Z</option></select></label></div>
    <nav className="community-filters" aria-label="Saved topics">{topics.map(value=><button type="button" key={value} aria-pressed={topic===value} onClick={()=>setTopic(value)}>{value}</button>)}</nav>
    <div className="community-results-heading"><h2>Your saved posts</h2><span>{loading?'Loading…':`${filtered.length} of ${posts.length} saved`}{refreshing?' · updating':''}</span></div>
    {notice&&<div className="community-notice" role="status"><span>{notice}</span>{removed&&<button type="button" disabled={Boolean(busy)} onClick={undo}>Undo</button>}</div>}
    {error&&<div className="community-error" role="alert"><p>{error}</p><button type="button" disabled={refreshing} onClick={()=>load(posts.length>0)}>Try again</button></div>}
    {loading?<div className="community-skeleton-grid" role="status" aria-label="Loading saved posts">{Array.from({length:6},(_,i)=><i key={i}/>)}</div>:
      filtered.length?<div className="saved-grid">{filtered.map(post=><SavedCard key={contentId(post)} post={post} busy={Boolean(busy)} onRemove={remove} onOpen={id=>navigate(`/reel/${encodeURIComponent(id)}`)}/>)}</div>:
      !error&&<div className="community-empty"><Bookmark size={26}/><h3>{posts.length?'No matching saved posts.':'Keep the ideas that matter.'}</h3><p>{posts.length?'Try another topic or a shorter search.':'Bookmark a post from the feed and it will be waiting here.'}</p>{posts.length?<button type="button" onClick={reset}>Clear filters</button>:<Link to="/feed?topic=All">Explore the feed<ArrowUpRight size={15}/></Link>}</div>}
  </main>;
}
