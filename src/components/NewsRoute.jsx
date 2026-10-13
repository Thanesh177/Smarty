import { lazy, Suspense } from 'react';

const News = lazy(() => import('../pages/NewsPage'));
const Story = lazy(() => import('../pages/NewsStoryPage'));
function OpeningNews() {
  return <section className="news-route-opening" role="status" aria-label="Opening news"><span>SMARTY / NEWS</span><h1>The day, in perspective.</h1><i/><i/><i/></section>;
}
export default function NewsRoute(props) { return <Suspense fallback={<OpeningNews/>}><News {...props}/></Suspense>; }
export function NewsStoryRoute() { return <Suspense fallback={<OpeningNews/>}><Story/></Suspense>; }
