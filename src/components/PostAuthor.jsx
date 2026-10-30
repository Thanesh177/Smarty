import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { creatorApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { getPostAuthorId, getPostAuthorUsername, getPostAuthorProfilePath } from '../lib/postAuthor';
import './PostAuthor.css';

export default function PostAuthor({ post, className = '', resolve = true, profileData, state }) {
  const { user } = useAuth();
  const id = getPostAuthorId(post);
  const account = String(user?.sub || user?.userId || user?.id || 'guest');
  const profile = useQuery({
    queryKey: ['post-author-label', account, id],
    queryFn: () => creatorApi.getProfile(id),
    enabled: Boolean(user && id && resolve), staleTime: 300000, retry: false, refetchOnWindowFocus: false,
  });
  const username = getPostAuthorUsername(post, profileData || profile.data);
  if (!id) return <span className={className}>{username}</span>;
  return <Link className={'post-author-link ' + className} to={getPostAuthorProfilePath(post)}
    state={{ ...state, creatorId: id, databaseAuthorId: id }}
    aria-label={`Open ${username}'s profile`} onClick={event => event.stopPropagation()}>{username}</Link>;
}
