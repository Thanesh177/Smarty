import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, BookOpen, Check, Layers, MessageCircle, Play, RefreshCw, Search, Share2, UserPlus } from 'lucide-react';
import { creatorApi, postApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { getPostAuthorUsername } from '../lib/postAuthor';
import { normalizePostResponse } from '../lib/postResponse';
import { getPostVideoUrl } from '../lib/videoFeed';
import { contentId, contentList, contentTopics, filterContent } from '../lib/communityContent';
import { postReadingStats } from '../lib/postDraft';
import './CreatorProfile.css';

export default function CreatorProfilePage() {
  const { userId } = useParams(), { user } = useAuth();
  const account = String(user?.sub || user?.userId || user?.id || 'guest');
  return <PublicProfile key={account + ':' + userId} userId={userId} account={account} user={user}/>;
}
function PublicProfile({ userId, account, user }) {
  const navigate = useNavigate(), client = useQueryClient(), lock = useRef(false), mounted = useRef(true);
  const [tab, setTab] = useState('posts'), [search, setSearch] = useState(''), [kind, setKind] = useState('all');
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const profileKey = ['public-profile', account, userId, 'identity'];
  const profileQuery = useQuery({ queryKey: profileKey, queryFn: async () => {
    const result = normalizePostResponse(await creatorApi.getProfile(userId));
    if (!(result.userId || result.id || result.sub || result.username || result.name)) throw new Error('Profile unavailable');
    return result;
  }, enabled: Boolean(userId), staleTime: 60000, retry: 1 });
  const profile = profileQuery.data;
  const postsQuery = useQuery({ queryKey: ['public-profile', account, userId, 'posts'], queryFn: () => postApi.getPostsByCreator(userId), enabled: Boolean(profile), staleTime: 60000, retry: 1 });
  const peopleQuery = useQuery({ queryKey: ['public-profile', account, userId, 'people', tab], queryFn: () => tab === 'followers' ? creatorApi.getFollowers(userId) : creatorApi.getFollowing(userId), enabled: Boolean(profile && tab !== 'posts'), staleTime: 60000, retry: 1 });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const name = getPostAuthorUsername(null, profile), own = account === userId || profile?.isMe === true;
  const avatar = getPostVideoUrl({ videoUrl: profile?.avatarUrl || profile?.photoUrl || profile?.profilePic });
  const [avatarFailed, setAvatarFailed] = useState(false);
  const posts = contentList(postsQuery.data);
  const shown = filterContent(posts.filter(post => kind === 'all' || Boolean(getPostVideoUrl(post)) === (kind === 'video')), { query: search });
  const people = Array.isArray(peopleQuery.data) ? peopleQuery.data : peopleQuery.data?.[tab] || peopleQuery.data?.items || [];
  const count = value => Math.max(0, Number(value) || 0);
  const stats = { posts: profile?.postsCount ?? profile?.reelsCount ?? posts.length, followers: profile?.followersCount ?? (tab === 'followers' ? people.length : 0), following: profile?.followingCount ?? (tab === 'following' ? people.length : 0) };
  const requireUser = () => {
    if (user) return true;
    navigate('/login', { state: { from: { pathname: '/creator/' + encodeURIComponent(userId) } } }); return false;
  };
  const follow = async () => {
    if (!requireUser() || own || !profile || lock.current || profile.requestPending) return;
    lock.current = true; setBusy(true); setNotice('');
    try {
      const unfollow = profile.isFollowing;
      const result = normalizePostResponse(await (unfollow ? creatorApi.unfollow(userId) : creatorApi.follow(userId)));
      if (!mounted.current) return;
      const following = !unfollow && (result.isFollowing === true || result.following === true || result.requestPending === false || ['accepted','following'].includes(result.status));
      const pending = !unfollow && !following;
      client.setQueryData(profileKey, previous => ({ ...previous, isFollowing: following, requestPending: pending,
        followersCount: Math.max(0, count(previous?.followersCount) + (unfollow ? -1 : following ? 1 : 0)) }));
      setNotice(unfollow ? 'You’re no longer following this member.' : pending ? 'Follow request sent.' : 'You’re now following this member.');
      client.invalidateQueries({ queryKey: ['public-profile', account, userId, 'people', 'followers'] });
    } catch { if (mounted.current) setNotice('This follow update could not be completed. Please try again.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const message = () => {
    if (!requireUser()) return;
    navigate('/chat', { state: { startWithUser: { userId, id: userId, sub: userId, username: name, name } } });
  };
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: name + ' on Smarty', url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); if (mounted.current) setNotice('Profile link copied.'); }
    } catch (error) { if (error?.name !== 'AbortError' && mounted.current) setNotice('The profile link could not be shared.'); }
  };
  const failure = (query, label) => <div className="public-profile-empty" role="alert"><h2>{label}</h2><p>Check your connection and try again.</p><button type="button" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw size={16}/>Try again</button></div>;
  return <main className="creator-profile-container public-profile-page" aria-labelledby="public-profile-name">
    <nav className="public-profile-nav" aria-label="Profile navigation"><Link to="/feed?topic=All"><Layers size={16}/>Feed</Link><Link to="/feed?topic=All" className="public-profile-brand">Smarty</Link><button type="button" onClick={share} aria-label="Share profile"><Share2 size={17}/></button></nav>
    {profileQuery.isPending ? <div className="public-profile-skeleton" role="status" aria-label="Loading profile"><i/><i/><i/></div> : profileQuery.isError || !profile ? failure(profileQuery,'This profile could not load.') : <>
      <header className="public-profile-header"><div className="public-profile-avatar">{avatar && !avatarFailed ? <img src={avatar} alt="" decoding="async" onError={() => setAvatarFailed(true)}/> : name.slice(0,1).toUpperCase()}</div><div className="public-profile-identity"><small>MEMBER PROFILE</small><h1 id="public-profile-name">{name}</h1><p>{profile.bio || 'Sharing ideas and learning along the way.'}</p></div><div className="public-profile-actions">{own ? <Link to="/profile">Edit profile<ArrowUpRight size={15}/></Link> : <><button type="button" className="public-profile-follow" aria-pressed={Boolean(profile.isFollowing)} disabled={busy || profile.requestPending} onClick={follow}>{profile.isFollowing || profile.requestPending ? <Check size={16}/> : <UserPlus size={16}/>} {busy ? 'Updating…' : profile.requestPending ? 'Requested' : profile.isFollowing ? 'Following' : 'Follow'}</button><button type="button" onClick={message}><MessageCircle size={16}/>Message</button></>}</div></header>
      {notice && <p className="public-profile-notice" role="status">{notice}</p>}
      <nav className="public-profile-tabs" aria-label="Profile sections">{[['posts','Posts'],['followers','Followers'],['following','Following']].map(([value,label]) => <button type="button" key={value} aria-pressed={tab === value} onClick={() => { setTab(value); setSearch(''); }}><strong>{count(stats[value])}</strong>{label}</button>)}</nav>
      <section className="public-profile-collection" aria-label={tab === 'posts' ? 'Recent contributions' : tab}>
        <header className="public-profile-collection-heading"><div><small>{tab === 'posts' ? 'IDEAS SHARED' : 'THE COMMUNITY'}</small><h2>{tab === 'posts' ? 'Recent contributions' : tab === 'followers' ? 'Followers' : 'Following'}</h2></div>{tab === 'posts' && <label className="public-profile-kind"><span className="public-profile-sr">Content type</span><select aria-label="Profile content type" value={kind} onChange={event => setKind(event.target.value)}><option value="all">All posts</option><option value="read">Reads</option><option value="video">Videos</option></select></label>}</header>
        {tab === 'posts' && posts.length > 0 && <label className="public-profile-search"><Search size={16}/><input type="search" aria-label="Search this member’s posts" placeholder="Find an idea" value={search} onChange={event => setSearch(event.target.value)}/></label>}
        {tab === 'posts' ? postsQuery.isPending ? <p role="status">Loading contributions…</p> : postsQuery.isError ? failure(postsQuery,'Contributions could not load.') : shown.length ? <div className="public-profile-posts">{shown.map(post => {
          const id = contentId(post), video = getPostVideoUrl(post), thumbnail = getPostVideoUrl({ videoUrl: post.thumbUrl || post.imageUrl }), topic = contentTopics(post)[0] || 'Smarty';
          return <Link className="public-profile-post" key={id} to={'/reel/' + encodeURIComponent(id)}><div className="public-profile-thumbnail">{thumbnail ? <img src={thumbnail} alt="" loading="lazy" decoding="async" onError={event => { event.currentTarget.hidden = true; }}/> : video ? <Play size={22}/> : <BookOpen size={22}/>}</div><div><small>{topic} · {video ? 'Video' : postReadingStats(post.body || '').minutes + ' min read'}</small><h3>{post.title || 'An idea to explore'}</h3><p>{post.body || post.description}</p></div><ArrowUpRight size={16}/></Link>;
        })}</div> : <div className="public-profile-empty"><h2>{posts.length ? 'No matching ideas.' : 'A collection waiting to grow.'}</h2><p>{posts.length ? 'Try another search or content type.' : 'New contributions will appear here.'}</p>{posts.length > 0 && <button type="button" onClick={() => { setSearch(''); setKind('all'); }}>Clear filters</button>}</div>
        : peopleQuery.isPending ? <p role="status">Loading members…</p> : peopleQuery.isError ? failure(peopleQuery,'These members could not load.') : people.length ? <div className="public-profile-people">{people.map((person,index) => {
          const id = String(person.userId || person.followerId || person.followingId || person.id || ''), label = getPostAuthorUsername(null,person);
          return <Link key={id || index} to={id ? '/creator/' + encodeURIComponent(id) : '#'} onClick={event => { if (!id) event.preventDefault(); }} aria-disabled={!id}><span>{label.slice(0,1).toUpperCase()}</span><div><strong>{label}</strong><small>Smarty member</small></div><ArrowUpRight size={16}/></Link>;
        })}</div> : <div className="public-profile-empty"><h2>{tab === 'followers' ? 'No followers yet.' : 'No members followed yet.'}</h2><p>Connections grow one good conversation at a time.</p></div>}
      </section>
    </>}
  </main>;
}
