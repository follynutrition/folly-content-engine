import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/lib/store';
import { getSegment } from '@/lib/config';
import { Kbd } from '@/components/Kbd';
import { scanPackage, hasHardFlags } from '@/lib/compliance-scanner';
import { repromptBlog, repromptEmail } from '@/lib/claude-api';
import type { ContentPackage, PackageStatus } from '@/lib/types';

interface ReviewProps {
  segmentId: string;
  onComplete: () => void;
}

type ReviewMode = 'flip' | 'list';
type FilterType = 'all' | 'pending' | 'needs_edit' | 'approved' | 'rejected';

export function Review({ segmentId, onComplete }: ReviewProps) {
  const { state, actions } = useStore();
  const seg = getSegment(segmentId);
  const segState = state.runs[state.activeRunId]?.segments[segmentId];
  const packages = segState?.packages ?? [];

  const [cur, setCur] = useState(0);
  const [mode, setMode] = useState<ReviewMode>('flip');
  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [editValues, setEditValues] = useState<Partial<ContentPackage>>({});

  // Reprompt state
  const [reprompting, setReprompting] = useState(false);
  const [repromptInstruction, setRepromptInstruction] = useState('');
  const [repromptLoading, setRepromptLoading] = useState<'blog' | 'email' | null>(null);
  const repromptInputRef = useRef<HTMLInputElement>(null);

  const color = seg?.color ?? '#E8457A';
  const pkg = packages[cur];
  const pending = packages.filter(p => p.status === 'pending' || p.status === 'needs_edit').length;

  // Use refs for values accessed inside the keyboard handler to keep the effect stable
  const curRef = useRef(cur);
  curRef.current = cur;
  const pkgRef = useRef(pkg);
  pkgRef.current = pkg;
  const packagesRef = useRef(packages);
  packagesRef.current = packages;
  const editValuesRef = useRef(editValues);
  editValuesRef.current = editValues;
  const repromptingRef = useRef(reprompting);
  repromptingRef.current = reprompting;

  const setStatus = useCallback((status: PackageStatus) => {
    const currentPkg = pkgRef.current;
    if (!currentPkg) return;
    actions.updatePackage(segmentId, currentPkg.id, { status });
    setEditing(false);
    // Auto-advance to next pending
    const currentCur = curRef.current;
    const currentPackages = packagesRef.current;
    setTimeout(() => {
      const next = currentPackages.findIndex((p, i) => i > currentCur && (p.status === 'pending' || p.status === 'needs_edit'));
      if (next >= 0) setCur(next);
      else if (currentCur < currentPackages.length - 1) setCur(c => c + 1);
    }, 200);
  }, [segmentId, actions]);

  const saveEdit = useCallback(() => {
    const currentPkg = pkgRef.current;
    if (!currentPkg) return;
    actions.updatePackage(segmentId, currentPkg.id, { ...editValuesRef.current, status: 'approved' });
    setEditing(false);
    setEditValues({});
  }, [segmentId, actions]);

  // Focus the reprompt input when toggled on
  useEffect(() => {
    if (reprompting && repromptInputRef.current) {
      repromptInputRef.current.focus();
    }
  }, [reprompting]);

  const handleRepromptBlog = useCallback(async () => {
    const currentPkg = pkgRef.current;
    if (!currentPkg || !repromptInstruction.trim()) return;
    setRepromptLoading('blog');
    try {
      const result = await repromptBlog(currentPkg, repromptInstruction.trim());
      const updates: Partial<ContentPackage> = {
        headline: result.headline,
        metaTitle: result.meta_title,
        metaDescription: result.meta_description,
        blogBody: result.body_html,
        blogTags: result.tags,
        wordCount: result.word_count,
      };
      // Re-run compliance on the updated package
      const updatedPkg = { ...currentPkg, ...updates };
      const flags = scanPackage(updatedPkg);
      updates.complianceFlags = flags;
      if (hasHardFlags(flags)) {
        updates.status = 'needs_edit';
      }
      actions.updatePackage(segmentId, currentPkg.id, updates);
      setReprompting(false);
      setRepromptInstruction('');
    } catch {
      // stay in reprompt mode so user can retry
    } finally {
      setRepromptLoading(null);
    }
  }, [repromptInstruction, segmentId, actions]);

  const handleRepromptEmail = useCallback(async () => {
    const currentPkg = pkgRef.current;
    if (!currentPkg || !repromptInstruction.trim()) return;
    setRepromptLoading('email');
    try {
      const result = await repromptEmail(currentPkg, currentPkg.blogBody, repromptInstruction.trim());
      const updates: Partial<ContentPackage> = {
        subjectLine: result.subject_line,
        previewText: result.preview_text,
        emailBody: result.body_text,
        ctaText: result.cta_text,
      };
      // Re-run compliance on the updated package
      const updatedPkg = { ...currentPkg, ...updates };
      const flags = scanPackage(updatedPkg);
      updates.complianceFlags = flags;
      if (hasHardFlags(flags)) {
        updates.status = 'needs_edit';
      }
      actions.updatePackage(segmentId, currentPkg.id, updates);
      setReprompting(false);
      setRepromptInstruction('');
    } catch {
      // stay in reprompt mode so user can retry
    } finally {
      setRepromptLoading(null);
    }
  }, [repromptInstruction, segmentId, actions]);

  // Keyboard shortcuts — deps are stable (editing and reprompting are the reactive deps)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // When reprompt input is focused, only handle Escape
      if (repromptingRef.current) {
        if (e.key === 'Escape') {
          setReprompting(false);
          setRepromptInstruction('');
        }
        return;
      }
      if (editing) {
        if (e.key === 'Escape') { setEditing(false); setEditValues({}); }
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'a') setStatus('approved');
      if (e.key === 'r') setStatus('rejected');
      if (e.key === 'e') { setEditing(true); setEditValues({}); }
      if (e.key === 'p') { setReprompting(true); setRepromptInstruction(''); }
      if (e.key === 'ArrowRight' || e.key === 'j') setCur(c => Math.min(c + 1, packagesRef.current.length - 1));
      if (e.key === 'ArrowLeft' || e.key === 'k') setCur(c => Math.max(c - 1, 0));
      if (e.key === 'l') setMode(m => m === 'flip' ? 'list' : 'flip');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editing, setStatus]);

  // All reviewed state
  if (pending === 0 && packages.length > 0) {
    const approved = packages.filter(p => p.status === 'approved').length;
    const rejected = packages.filter(p => p.status === 'rejected').length;
    return (
      <div className="text-center py-[72px] max-w-[440px] mx-auto">
        <div className="w-[52px] h-[52px] rounded-full bg-success flex items-center justify-center mx-auto mb-4 text-[22px] text-white">✓</div>
        <h2 className="text-[22px] font-semibold mb-2">All packages reviewed</h2>
        <p className="text-neutral-500 text-sm mb-6">{approved} approved · {rejected} rejected</p>
        <button
          onClick={onComplete}
          className="px-7 py-3 rounded-[10px] border-none cursor-pointer text-white text-sm font-semibold bg-primary-500 hover:brightness-110 transition-[filter]"
        >
          Publish →
        </button>
      </div>
    );
  }

  // List mode
  if (mode === 'list') {
    const filtered = filter === 'all' ? packages : packages.filter(p => p.status === filter);
    return (
      <div className="max-w-[760px] mx-auto">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-1.5">
            {(['all', 'pending', 'needs_edit', 'approved', 'rejected'] as FilterType[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-md text-xs border-none cursor-pointer transition-colors ${
                  filter === f ? 'bg-neutral-700 text-neutral-50' : 'bg-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {f === 'needs_edit' ? 'Needs Edit' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setMode('flip')}
            className="px-3 py-[5px] rounded-[7px] border border-neutral-700 bg-transparent text-neutral-300 text-xs cursor-pointer flex items-center gap-1.5"
          >
            Flip-through <Kbd>L</Kbd>
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {filtered.map((p) => {
            const statusColor = p.status === 'approved' ? 'var(--color-success)' : p.status === 'rejected' ? 'var(--color-error)' : 'var(--color-warning)';
            return (
              <div
                key={p.id}
                onClick={() => { setCur(packages.indexOf(p)); setMode('flip'); }}
                className="bg-neutral-800 rounded-[10px] border border-neutral-700 p-3 px-3.5 cursor-pointer hover:border-neutral-600 transition-[border-color]"
                style={{ borderLeftWidth: 3, borderLeftColor: statusColor }}
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="text-sm text-neutral-50 mb-[3px]">{p.headline}</div>
                    <div className="text-xs text-neutral-500">✉ {p.subjectLine}</div>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    {p.complianceFlags.length > 0 && (
                      <span className="text-[10px] text-warning">⚠ {p.complianceFlags.length}</span>
                    )}
                    <span
                      className="text-[10px] font-mono tracking-wide px-[7px] py-[1px] rounded-full"
                      style={{ color: statusColor, backgroundColor: `${statusColor}1F` }}
                    >
                      {p.status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Flip-through mode
  if (!pkg) return null;

  // Shimmer skeleton for loading state
  const ShimmerBlock = ({ height }: { height: string }) => (
    <div
      className="rounded-[7px] overflow-hidden"
      style={{ height, background: 'linear-gradient(90deg, #2a2a2a 25%, #333 50%, #2a2a2a 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }}
    />
  );

  return (
    <div className="max-w-[880px] mx-auto">
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>

      {/* Progress bar */}
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="text-[13px] text-neutral-500">Pkg {cur + 1}/{packages.length}</span>
        <div className="flex-1 h-[3px] bg-neutral-800 rounded-sm">
          <div
            className="h-full rounded-sm transition-[width] duration-300"
            style={{ width: `${((cur + 1) / packages.length) * 100}%`, backgroundColor: color }}
          />
        </div>
        <button
          onClick={() => setMode('list')}
          className="px-2.5 py-1 rounded-[6px] border border-neutral-700 bg-transparent text-neutral-500 text-[11px] cursor-pointer flex items-center gap-1"
        >
          List <Kbd>L</Kbd>
        </button>
      </div>

      {/* Dot navigation */}
      <div className="flex gap-1 mb-[18px]">
        {packages.map((p, i) => (
          <div
            key={p.id}
            onClick={() => setCur(i)}
            className="rounded-[4px] cursor-pointer transition-all duration-200"
            style={{
              width: i === cur ? 26 : 8,
              height: 8,
              backgroundColor: p.status === 'approved' ? 'var(--color-success)'
                : p.status === 'rejected' ? 'var(--color-error)'
                : i === cur ? color : 'var(--color-neutral-700)',
            }}
          />
        ))}
      </div>

      {/* Compliance flags */}
      {pkg.complianceFlags.length > 0 && (
        <div className="flex gap-1.5 mb-3.5 flex-wrap">
          {pkg.complianceFlags.map((flag, i) => (
            <span
              key={i}
              className="text-[11px] px-2.5 py-1 rounded-[6px] font-mono"
              style={{
                backgroundColor: flag.severity === 'hard' ? 'rgba(199,84,80,0.12)' : 'rgba(212,168,67,0.12)',
                color: flag.severity === 'hard' ? 'var(--color-error)' : 'var(--color-warning)',
              }}
            >
              {flag.message}
            </span>
          ))}
        </div>
      )}

      {/* Source question */}
      <div className="text-[11px] text-neutral-600 mb-2.5">
        Answering: <em>"{pkg.sourceQuestion}"</em>
      </div>

      {/* Split view: Blog + Email */}
      <div className="flex gap-4">
        {/* Blog Preview */}
        <div className="flex-[55%]">
          <div className="text-[10px] text-neutral-600 font-mono tracking-wide uppercase mb-2">Blog Preview</div>
          <div className="bg-white rounded-[10px] p-6 text-neutral-950">
            {/* Blog image */}
            <div
              className="w-full h-[100px] rounded-[7px] mb-4 flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${color}30, ${color}08)` }}
            >
              {pkg.blogImageUrl ? (
                <span className="text-[9px] font-mono" style={{ color }}>FEATURED IMAGE ✓</span>
              ) : (
                <span className="text-[9px] font-mono text-error">⚠ IMAGE MISSING</span>
              )}
            </div>

            {repromptLoading === 'blog' ? (
              <div className="flex flex-col gap-3">
                <ShimmerBlock height="28px" />
                <ShimmerBlock height="14px" />
                <ShimmerBlock height="80px" />
                <ShimmerBlock height="60px" />
              </div>
            ) : editing ? (
              <>
                <textarea
                  defaultValue={editValues.headline ?? pkg.headline}
                  onChange={e => setEditValues(prev => ({ ...prev, headline: e.target.value }))}
                  className="w-full text-lg font-serif border border-dashed border-neutral-400 rounded-[6px] p-2 bg-neutral-50 resize-y min-h-[48px] leading-tight"
                />
                <div className="text-[11px] text-neutral-400 mb-3">By Luna Yu · {pkg.wordCount} words</div>
                <textarea
                  defaultValue={editValues.blogBody ?? pkg.blogBody.replace(/<[^>]*>/g, '')}
                  onChange={e => setEditValues(prev => ({ ...prev, blogBody: `<p>${e.target.value}</p>` }))}
                  className="w-full text-[13px] border border-dashed border-neutral-400 rounded-[6px] p-2 bg-neutral-50 resize-y min-h-[60px] leading-relaxed"
                />
              </>
            ) : (
              <>
                <h2 className="text-lg font-serif leading-tight mb-2.5">{pkg.headline}</h2>
                <div className="text-[11px] text-neutral-400 mb-3">By Luna Yu · {pkg.wordCount} words</div>
                <p className="text-[13px] leading-relaxed text-neutral-700">
                  {pkg.blogBody.replace(/<[^>]*>/g, '').substring(0, 300)}...
                </p>
              </>
            )}
          </div>
        </div>

        {/* Email Preview */}
        <div className="flex-[45%]">
          <div className="text-[10px] text-neutral-600 font-mono tracking-wide uppercase mb-2">Email Preview</div>
          <div className="bg-white rounded-[10px] text-neutral-950 overflow-hidden">
            {/* Subject + preview */}
            <div className="p-3.5 bg-neutral-50 border-b border-neutral-100">
              {repromptLoading === 'email' ? (
                <div className="flex flex-col gap-1.5">
                  <ShimmerBlock height="16px" />
                  <ShimmerBlock height="12px" />
                </div>
              ) : editing ? (
                <>
                  <input
                    defaultValue={editValues.subjectLine ?? pkg.subjectLine}
                    onChange={e => setEditValues(prev => ({ ...prev, subjectLine: e.target.value }))}
                    className="w-full text-xs font-semibold border border-dashed border-neutral-400 rounded p-1 bg-white"
                  />
                  <div className="text-[10px] text-neutral-400 text-right mt-0.5">
                    {(editValues.subjectLine ?? pkg.subjectLine).length}/50
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs font-semibold">{pkg.subjectLine}</div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">{pkg.previewText}</div>
                </>
              )}
            </div>

            {/* Hero image */}
            <div
              className="w-full h-[80px] flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, #E8457A22, ${color}08)` }}
            >
              {pkg.emailImageUrl ? (
                <span className="text-[9px] font-mono text-primary-500">HERO IMAGE ✓</span>
              ) : (
                <span className="text-[9px] font-mono text-error">⚠ IMAGE MISSING</span>
              )}
            </div>

            {/* Body */}
            <div className="p-3.5">
              {repromptLoading === 'email' ? (
                <div className="flex flex-col gap-2 mb-3">
                  <ShimmerBlock height="14px" />
                  <ShimmerBlock height="14px" />
                  <ShimmerBlock height="14px" />
                </div>
              ) : editing ? (
                <textarea
                  defaultValue={editValues.emailBody ?? pkg.emailBody}
                  onChange={e => setEditValues(prev => ({ ...prev, emailBody: e.target.value }))}
                  className="w-full text-xs border border-dashed border-neutral-400 rounded p-1.5 bg-neutral-50 resize-y min-h-[40px] leading-relaxed"
                />
              ) : (
                <p className="text-xs leading-relaxed text-neutral-700 mb-3">{pkg.emailBody}</p>
              )}
              <div className="text-center mb-3">
                <div className="inline-block px-5 py-2 rounded-[7px] bg-primary-500 text-white text-xs font-semibold">
                  {pkg.ctaText} →
                </div>
              </div>
              <div className="border-t border-neutral-100 pt-2.5 text-center">
                <div className="text-[13px] font-bold text-primary-500">Try Folly for $1</div>
                <div className="text-[10px] text-neutral-400">TRYFOLLY1</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex justify-center gap-2.5 mt-5">
        {editing ? (
          <>
            <button
              onClick={() => { setEditing(false); setEditValues({}); }}
              className="px-5 py-2.5 rounded-lg border border-neutral-700 bg-transparent text-neutral-300 text-[13px] cursor-pointer flex items-center gap-1.5"
            >
              Cancel <Kbd>Esc</Kbd>
            </button>
            <button
              onClick={saveEdit}
              className="px-5 py-2.5 rounded-lg border-none bg-success text-white text-[13px] font-semibold cursor-pointer"
            >
              Save & Approve
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setStatus('rejected')}
              className="px-6 py-2.5 rounded-lg border-none bg-error text-white text-[13px] font-semibold cursor-pointer flex items-center gap-1.5"
            >
              Reject <Kbd>R</Kbd>
            </button>
            <button
              onClick={() => { setEditing(true); setEditValues({}); }}
              className="px-6 py-2.5 rounded-lg border border-neutral-700 bg-transparent text-neutral-300 text-[13px] font-semibold cursor-pointer flex items-center gap-1.5"
            >
              Edit <Kbd>E</Kbd>
            </button>
            <button
              onClick={() => { setReprompting(r => !r); setRepromptInstruction(''); }}
              className="px-6 py-2.5 rounded-lg border border-neutral-700 bg-transparent text-neutral-300 text-[13px] font-semibold cursor-pointer flex items-center gap-1.5"
            >
              Reprompt <Kbd>P</Kbd>
            </button>
            <button
              onClick={() => setStatus('approved')}
              className="px-7 py-2.5 rounded-lg border-none bg-success text-white text-[13px] font-semibold cursor-pointer flex items-center gap-1.5"
            >
              Approve <Kbd>A</Kbd>
            </button>
          </>
        )}
      </div>

      {/* Reprompt panel */}
      {reprompting && (
        <div className="mt-3 flex flex-col gap-2.5 max-w-[600px] mx-auto">
          <input
            ref={repromptInputRef}
            type="text"
            value={repromptInstruction}
            onChange={e => setRepromptInstruction(e.target.value)}
            placeholder="e.g., Make it shorter and more urgent"
            className="w-full px-3.5 py-2.5 rounded-lg bg-neutral-800 border border-neutral-600 text-neutral-100 text-[13px] placeholder:text-neutral-500 outline-none focus:border-primary-500 transition-colors"
            onKeyDown={e => {
              if (e.key === 'Escape') { setReprompting(false); setRepromptInstruction(''); }
            }}
            disabled={repromptLoading !== null}
          />
          <div className="flex justify-center gap-2">
            <button
              onClick={handleRepromptBlog}
              disabled={!repromptInstruction.trim() || repromptLoading !== null}
              className="px-5 py-2 rounded-lg border-none text-white text-[13px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              style={{ backgroundColor: color }}
            >
              {repromptLoading === 'blog' ? 'Reprompting...' : 'Reprompt Blog'}
            </button>
            <button
              onClick={handleRepromptEmail}
              disabled={!repromptInstruction.trim() || repromptLoading !== null}
              className="px-5 py-2 rounded-lg border-none text-white text-[13px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              style={{ backgroundColor: color }}
            >
              {repromptLoading === 'email' ? 'Reprompting...' : 'Reprompt Email'}
            </button>
          </div>
        </div>
      )}

      {!editing && !reprompting && (
        <div className="text-center mt-1.5 text-[11px] text-neutral-700">
          ← → navigate · L list view · P reprompt
        </div>
      )}
    </div>
  );
}
