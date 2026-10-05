import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { creatorApi, postApi, userApi } from '../api/client';
import './CreatorDashboardPage.css';
import './CommunityWorkspace.css';
import { useAuth } from '../contexts/AuthContext';
import { contentId, contentList, contentTopics, filterContent, personId } from '../lib/communityContent';
import { Search, RotateCcw, ArrowUpRight, Plus, X } from 'lucide-react';

const RequestRow = memo(function RequestRow({ request, index, processingKey, onApprove, onReject }) {
  const followerId = personId(request);
  const followerName = request.followerName || 'User';
  const followerEmail = request.username ? `@${request.username}` : 'Requested access to your private posts';

  return (
    <article className="request-row">
      <div className="request-avatar">
        {(request.followerName || request.followerEmail || 'U')[0].toUpperCase()}
      </div>

      <div>
        <h3>{followerName}</h3>
        <p>{followerEmail}</p>
      </div>

      <div className="request-actions">
        <button
          type="button"
          disabled={!followerId || Boolean(processingKey)}
          onClick={() => onApprove(followerId)}
        >
          Approve
        </button>

        <button
          type="button"
          className="muted"
          disabled={!followerId || Boolean(processingKey)}
          onClick={() => onReject(followerId)}
        >
          Decline
        </button>
      </div>
    </article>
  );
});

const DashboardPostCard = memo(function DashboardPostCard({ post, index, onOpen }) {
  const postId = contentId(post);
  const [imageFailed,setImageFailed] = useState(false);
  const isPrivate = post.visibility === 'private' || post.isPrivate === true || post.private === true;

  return (
    <button
      className="dashboard-post-card"
      type="button"
      disabled={!postId}
      onClick={() => onOpen(postId)}
    >
      {post.imageUrl && !imageFailed ? (
        <img
          src={post.imageUrl}
          alt={post.title || 'Post'}
          loading={index < 2 ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={index < 2 ? 'high' : 'auto'}
          onError={()=>setImageFailed(true)}
        />
      ) : (
        <div className="dashboard-post-placeholder">
          {contentTopics(post)[0] || 'Smarty'}
        </div>
      )}

      <div>
        <span>{isPrivate ? 'Private' : 'Public'}</span>
        <h3>{post.title || 'Untitled post'}</h3>
        <p>{contentTopics(post).join(' · ') || 'Smarty'}</p>
      </div>
    </button>
  );
});

export default function CreatorDashboardPage() {
  const navigate = useNavigate();
  const {user}=useAuth();
  const account=String(user?.sub||user?.id||user?.userId||'guest');
  const mountedRef = useRef(true);
  const generation=useRef(0),actionBusy=useRef(false);

  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [myPosts, setMyPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [contentLoading, setContentLoading] = useState(false);
  const [processingKey, setProcessingKey] = useState('');
  const [errors,setErrors]=useState({});
  const [query,setQuery]=useState(''),[visibility,setVisibility]=useState('all');

  const loadDashboard = useCallback(async (silent=false) => {
    if(actionBusy.current)return;
    const ticket=++generation.current;
    const valid=()=>mountedRef.current&&ticket===generation.current;
    try {
      if(!silent)setLoading(true);
      setContentLoading(true);setErrors({});
      setStatus('');
      const [profileResult,requestResult, postsResult] = await Promise.allSettled([
        userApi.getMe(),
        creatorApi.getFollowRequests(),
        postApi.getMyReels(),
      ]);

      if (!valid()) return;
      const failures={};
      if(profileResult.status==='fulfilled')setProfile(profileResult.value?.profile||profileResult.value||null);
      else failures.profile='Your profile could not be loaded.';

      if (requestResult.status === 'fulfilled') {
        const requestData = requestResult.value;
        const list = Array.isArray(requestData?.requests)
            ? requestData.requests
            : Array.isArray(requestData)
              ? requestData
              : [];
        setRequests(list.filter(item=>item&&personId(item)));
      } else {
        failures.requests='Follow requests could not be loaded. This does not mean there are no requests.';
      }

      if (postsResult.status === 'fulfilled') {
        const postsData = postsResult.value;
        setMyPosts(contentList(postsData));
      } else {
        failures.posts='Your posts could not be loaded. Your existing posts have not been removed.';
      }
      setErrors(failures);
    } catch (err) {
      console.error(err);
      if (valid()) setStatus('Failed to load creator dashboard.');
    } finally {
      if (valid()) {
        setLoading(false);
        setContentLoading(false);
      }
    }
  }, [account]);

  useEffect(() => {
    mountedRef.current = true;
    actionBusy.current=false;setProcessingKey('');
    setProfile(null);setRequests([]);setMyPosts([]);setQuery('');setVisibility('all');
    let canceled=false;Promise.resolve().then(()=>{if(!canceled)void loadDashboard();});

    return () => {
      mountedRef.current = false;
      canceled=true;generation.current++;
    };
  }, [loadDashboard]);
  useEffect(()=>{
    const refresh=event=>event.detail?.waitUntil?.(loadDashboard(true));
    window.addEventListener('smarty-global-refresh',refresh);
    return()=>window.removeEventListener('smarty-global-refresh',refresh);
  },[loadDashboard]);

  const privatePosts = useMemo(
    () =>
      myPosts.filter(
        (post) =>
          post.visibility === 'private' ||
          post.isPrivate === true ||
          post.private === true
      ),
    [myPosts]
  );

  const publicPosts = useMemo(
    () =>
      myPosts.filter(
        (post) =>
          post.visibility !== 'private' &&
          post.isPrivate !== true &&
          post.private !== true
      ),
    [myPosts]
  );

  const approve = useCallback(async (followerId) => {
    if (!followerId || actionBusy.current) return;
    actionBusy.current=true;const ticket=generation.current;

    const actionKey = `approve-${followerId}`;

    try {
      setProcessingKey(actionKey);
      await creatorApi.approveFollowRequest(followerId);
      if (!mountedRef.current||ticket!==generation.current) return;

      setRequests((prev) => prev.filter((item) => personId(item) !== followerId));
      setStatus('Request approved.');
    } catch (err) {
      console.error(err);
      if (mountedRef.current&&ticket===generation.current) setStatus('Failed to approve request.');
    } finally {
      if(ticket===generation.current){actionBusy.current=false;if(mountedRef.current)setProcessingKey('');}
    }
  }, [processingKey]);

  const reject = useCallback(async (followerId) => {
    if (!followerId || actionBusy.current) return;
    actionBusy.current=true;const ticket=generation.current;

    const actionKey = `reject-${followerId}`;

    try {
      setProcessingKey(actionKey);
      await creatorApi.rejectFollowRequest(followerId);
      if (!mountedRef.current||ticket!==generation.current) return;

      setRequests((prev) => prev.filter((item) => personId(item) !== followerId));
      setStatus('Request rejected.');
    } catch (err) {
      console.error(err);
      if (mountedRef.current&&ticket===generation.current) setStatus('Failed to reject request.');
    } finally {
      if(ticket===generation.current){actionBusy.current=false;if(mountedRef.current)setProcessingKey('');}
    }
  }, [processingKey]);

  const approveAll = useCallback(async () => {
    const pendingIds = [...new Set(requests.map(personId).filter(Boolean))];
    if (pendingIds.length === 0 || actionBusy.current) return;
    actionBusy.current=true;const ticket=generation.current;

    try {
      setProcessingKey('approve-all');
      const results = await Promise.allSettled(
        pendingIds.map((followerId) => creatorApi.approveFollowRequest(followerId))
      );

      if (!mountedRef.current||ticket!==generation.current) return;

      const approvedIds = new Set(
        pendingIds.filter((_, index) => results[index]?.status === 'fulfilled')
      );

      setRequests((prev) => prev.filter((item) => !approvedIds.has(personId(item))));

      const failedCount = results.filter((result) => result.status === 'rejected').length;
      setStatus(failedCount ? `${approvedIds.size} approved, ${failedCount} failed.` : 'All requests approved.');
    } catch (err) {
      console.error(err);
      if (mountedRef.current&&ticket===generation.current) setStatus('Failed to approve all requests.');
    } finally {
      if(ticket===generation.current){actionBusy.current=false;if(mountedRef.current)setProcessingKey('');}
    }
  }, [processingKey, requests]);

  const goCreatePost = useCallback(() => {
    navigate('/create');
  }, [navigate]);

  const goPublicProfile = useCallback(() => {
    const profileId = profile?.id || profile?.userId || profile?.sub;
    if (profileId) navigate(`/creator/${encodeURIComponent(profileId)}`);
  }, [navigate, profile]);

  const openPost = useCallback(
    (postId) => {
      if (postId) navigate(`/reel/${encodeURIComponent(postId)}`);
    },
    [navigate]
  );

  const renderedRequests = useMemo(
    () => requests.map((request, index) => {
      const followerId = personId(request);

      return (
        <RequestRow
          key={followerId || `request-${index}`}
          request={request}
          index={index}
          processingKey={processingKey}
          onApprove={approve}
          onReject={reject}
        />
      );
    }),
    [approve, processingKey, reject, requests]
  );

  const filteredPosts=useMemo(()=>filterContent(myPosts,{query,visibility}),[myPosts,query,visibility]);
  const renderedPosts = useMemo(
    () => filteredPosts.map((post, index) => (
      <DashboardPostCard
        key={contentId(post)}
        post={post}
        index={index}
        onOpen={openPost}
      />
    )),
    [filteredPosts, openPost]
  );


  return (
    <main className="creator-dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span>CREATOR WORKSPACE</span>
          <h1>A space for what you share.</h1>
          <p>
            Your posts, your people, and the ideas you put into the world.
          </p>
        </div>

        <button className="dashboard-primary" type="button" onClick={goCreatePost}>
          <Plus size={16}/>Write a post
        </button>
      </section>

      {status && <p className="dashboard-status" role="status">{status}</p>}

      <section className="dashboard-stats">
        <div>
          <strong>{loading||errors.posts?'—':myPosts.length}</strong>
          <span>Total Posts</span>
        </div>

        <div>
          <strong>{loading||errors.posts?'—':privatePosts.length}</strong>
          <span>Private Posts</span>
        </div>

        <div>
          <strong>{loading||errors.posts?'—':publicPosts.length}</strong>
          <span>Public Posts</span>
        </div>

        <div>
          <strong>{loading||errors.requests?'—':requests.length}</strong>
          <span>Pending Requests</span>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-panel large">
          <div className="panel-head">
            <div>
              <h2>Follow Requests</h2>
              <p>Approve users before they can access your private posts.</p>
            </div>

            {requests.length > 0 && (
              <button className="small-action" type="button" disabled={Boolean(processingKey)||contentLoading} onClick={approveAll}>
                Approve All
              </button>
            )}
          </div>

          {errors.requests?<div className="community-error" role="alert"><p>{errors.requests}</p><button type="button" onClick={()=>loadDashboard(true)}>Try again</button></div>:contentLoading ? (
            <div className="dashboard-empty">
              <h3>Loading requests...</h3>
              <p>Checking for pending access requests.</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="dashboard-empty">
              <h3>No pending requests</h3>
              <p>New requests will appear here.</p>
            </div>
          ) : (
            <div className="request-list">
              {renderedRequests}
            </div>
          )}
        </div>

        <div className="dashboard-panel">
          <h2>Profile</h2>
          {errors.profile&&<p role="alert">{errors.profile}</p>}
          <p className="profile-mini">{profile?.email || profile?.username || 'Creator'}</p>

          <button
            className="dashboard-secondary"
            disabled={!(profile?.id || profile?.userId || profile?.sub)}
            onClick={goPublicProfile}
          >
            View your profile <ArrowUpRight size={14}/>
          </button>
        </div>
      </section>

      <section className="dashboard-panel posts-panel">
        <div className="panel-head">
          <div>
            <h2>Your Posts</h2>
            <p>{filteredPosts.length} posts · Open one to read or review it.</p>
          </div>
        </div>
        <div className="community-toolbar"><div className="community-search"><Search size={17}/><input type="search" aria-label="Search your posts" placeholder="Find one of your posts" value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button type="button" aria-label="Clear creator search" onClick={()=>setQuery('')}><X size={17}/></button>}</div><button type="button" className="community-icon-button" aria-label="Refresh creator dashboard" disabled={contentLoading||Boolean(processingKey)} onClick={()=>loadDashboard(true)}><RotateCcw size={17}/></button></div>
        <nav className="community-filters" aria-label="Post visibility">{[['all','All posts'],['public','Public'],['private','Private']].map(([value,label])=><button type="button" key={value} aria-pressed={visibility===value} onClick={()=>setVisibility(value)}>{label}</button>)}</nav>

        {errors.posts?<div className="community-error" role="alert"><p>{errors.posts}</p><button type="button" onClick={()=>loadDashboard(true)}>Try again</button></div>:contentLoading ? (
          <div className="dashboard-empty">
            <h3>Loading posts...</h3>
            <p>Fetching your latest posts.</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="dashboard-empty">
            <h3>{myPosts.length?'No posts in this selection':'Share your first idea.'}</h3>
            <p>{myPosts.length?'Try a different search or visibility filter.':'A useful explanation, a discovery, or a question worth exploring.'}</p>
            {myPosts.length>0&&<button type="button" className="small-action" onClick={()=>{setQuery('');setVisibility('all');}}>Clear filters</button>}
          </div>
        ) : (
          <div className="dashboard-post-grid">
            {renderedPosts}
          </div>
        )}
      </section>
    </main>
  );
}
