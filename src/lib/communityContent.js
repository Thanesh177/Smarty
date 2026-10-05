export const contentId = value => String(value?.reelId || value?.postId || value?.id || '').trim();
export const personId = value => String(value?.followerId || value?.userId || value?.id || value?.sub || '').trim();
export function contentTopics(value) {
  const topics = Array.isArray(value?.topic) ? value.topic : [value?.topic || value?.category];
  return [...new Set(topics.filter(item=>typeof item==='string').map(item=>item.trim()).filter(Boolean))];
}
export function contentList(data) {
  const list = Array.isArray(data) ? data : data?.posts || data?.reels || data?.items || [];
  if(!Array.isArray(list)) return [];
  const seen = new Set();
  return list.map(item=>({...item,...item?.item})).filter(item=>{
    const id=contentId(item);if(!id||seen.has(id))return false;seen.add(id);return true;
  });
}
export function filterContent(posts,{query='',topic='All',sort='recent',visibility='all'}={}) {
  const needle=query.trim().toLowerCase();
  return posts.filter(post=>{
    const privatePost=post.visibility==='private'||post.isPrivate===true||post.private===true;
    return (visibility==='all'||(visibility==='private'?privatePost:!privatePost)) && (topic==='All'||contentTopics(post).includes(topic)) && (!needle||`${post.title||''} ${post.body||post.description||''} ${contentTopics(post).join(' ')}`.toLowerCase().includes(needle));
  }).map((post,index)=>({post,index})).sort((a,b)=>sort==='title'?String(a.post.title||'').localeCompare(String(b.post.title||'')):
    ((Date.parse(b.post.savedAt||b.post.createdAt)||0)-(Date.parse(a.post.savedAt||a.post.createdAt)||0))||a.index-b.index).map(item=>item.post);
}
