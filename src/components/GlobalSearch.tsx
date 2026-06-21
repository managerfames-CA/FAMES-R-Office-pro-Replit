import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { services } from '../services';
import type { GlobalSearchResult } from '../services/Phase6Service';

export function GlobalSearch() {
  const [query,setQuery]=useState(''); const [results,setResults]=useState<GlobalSearchResult[]>([]); const [loading,setLoading]=useState(false); const [open,setOpen]=useState(false); const [error,setError]=useState('');
  const inputRef=useRef<HTMLInputElement>(null); const location=useLocation();
  useEffect(()=>{setOpen(false);setQuery('');setResults([]);},[location.pathname,location.search]);
  useEffect(()=>{const listener=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();inputRef.current?.focus();setOpen(true);} if(event.key==='Escape')setOpen(false);};window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);},[]);
  useEffect(()=>{const trimmed=query.trim();if(trimmed.length<2){setResults([]);setLoading(false);setError('');return;}setLoading(true);setError('');const handle=window.setTimeout(()=>{void services.phase6.search(trimmed).then(value=>{setResults(value);setOpen(true);}).catch(reason=>setError(reason instanceof Error?reason.message:'Search failed.')).finally(()=>setLoading(false));},180);return()=>window.clearTimeout(handle);},[query]);
  return <div className="global-search" role="search">
    <label className="sr-only" htmlFor="global-search-input">Search the application</label>
    <input ref={inputRef} id="global-search-input" value={query} onChange={event=>{setQuery(event.target.value);setOpen(true);}} onFocus={()=>setOpen(true)} placeholder="Search clients, engagements, invoices…" autoComplete="off" />
    <span className="search-shortcut">Ctrl K</span>
    {open&&query.trim().length>=2&&<div className="search-results" role="dialog" aria-label="Global search results">
      <div className="search-results-header"><strong>Global search</strong><button type="button" aria-label="Close search results" onClick={()=>setOpen(false)}>×</button></div>
      {loading&&<div className="search-state">Searching repositories…</div>}
      {error&&<div className="search-state error">{error}</div>}
      {!loading&&!error&&!results.length&&<div className="search-state"><strong>No matching records</strong><span>Try a client code, engagement code, invoice number, task, risk, working paper or report reference.</span></div>}
      {!loading&&!error&&results.length>0&&<div className="search-result-list">{results.map(result=><Link key={`${result.type}:${result.id}`} to={result.route} className="search-result" onClick={()=>setOpen(false)}><span className="search-result-type">{result.type}</span><span className="search-result-copy"><strong>{result.title}</strong><small>{result.subtitle}</small></span><span className={`search-result-status ${result.archived?'archived':''}`}>{result.archived?'Archived':result.status}</span></Link>)}</div>}
    </div>}
  </div>;
}
