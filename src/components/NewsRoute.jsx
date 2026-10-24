import { lazy, Suspense } from 'react';
import NewsLoading from './NewsLoading';

const News = lazy(() => import('../pages/NewsPage'));
const Story = lazy(() => import('../pages/NewsStoryPage'));
export default function NewsRoute(props) { return <Suspense fallback={<NewsLoading kind={props.briefingOnly ? 'briefing' : 'reports'} standalone />}><News {...props}/></Suspense>; }
export function NewsStoryRoute() { return <Suspense fallback={<NewsLoading kind="story" standalone />}><Story/></Suspense>; }
