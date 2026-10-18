import { useEffect, useRef, useState } from 'react';
import { Check, Download, LoaderCircle } from 'lucide-react';
import { hasNativeDownloads, requestNativeDownload } from '../lib/nativeDownloads';
import './NativeDownloadButton.css';

export default function NativeDownloadButton({payload, label = 'Download', iconOnly = false, className = '', onStatus}) {
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  if (!hasNativeDownloads()) return null;
  const save = async event => {
    event.preventDefault(); event.stopPropagation();
    if (state === 'busy') return;
    setError(''); setState('busy');
    try {
      await requestNativeDownload(typeof payload === 'function' ? payload() : payload);
      if (mounted.current) { setState('saved'); onStatus?.('Saved in Downloads on this device.'); }
    } catch (failure) {
      if (mounted.current) { setState('idle'); setError(failure.message); onStatus?.(failure.message); }
    }
  };
  const title = state === 'busy' ? 'Check Downloads to confirm or cancel' : state === 'saved' ? 'Downloaded · save again' : label;
  return <span className="native-download-control">
    <button type="button" className={className} onClick={save} disabled={state === 'busy'} aria-label={title} title={title}>
      {state === 'busy' ? <LoaderCircle size={18}/> : state === 'saved' ? <Check size={18}/> : <Download size={18}/>}
      {!iconOnly && <span>{state === 'saved' ? 'Downloaded' : label}</span>}
    </button>
    {error && !onStatus && <span role="status">{error}</span>}
  </span>;
}
