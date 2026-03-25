import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { getSegment } from '@/lib/config';
import { buildEmailHtml } from '@/lib/email-builder';
import { Kbd } from '@/components/Kbd';
import { scanPackage, hasHardFlags } from '@/lib/compliance-scanner';
import { repromptBlog, repromptEmail } from '@/lib/claude-api';
import { ArrowRight, PencilSimpleLine, Check, X, Sparkle, CaretDown } from '@phosphor-icons/react';
import type { ContentPackage, PackageStatus } from '@/lib/types';

interface ReviewProps {
  segmentId: string;
  onComplete: () => void;
}

export function Review({ segmentId, onComplete }: ReviewProps) {
  const { state, actions } = useStore();
  const seg = getSegment(segmentId);
  const segState = state.runs[state.activeRunId]?.segments[segmentId];
  const packages = segState?.packages ?? [];

  const [cur, setCur] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<Partial<ContentPackage>>({});

  // Reprompt — inline, always visible
  const [repromptInstruction, setRepromptInstruction] = useState('');
  const [repromptLoading, setRepromptLoading] = useState<'blog' | 'email' | null>(null);
  const repromptInputRef = useRef<HTMLInputElement>(null);

  // Batch approve
  const [batchConfirm, setBatchConfirm] = useState(false);

  // Reject dropdown (hidden by default)
  const [showRejectDrop, setShowRejectDrop] = useState(false);

  // Track shortcut usage for progressive disclosure
  const [shortcutUseCount, setShortcutUseCount] = useState(() => {
    try { return parseInt(localStorage.getItem('folly-shortcut-count') ?? '0', 10); } catch { return 0; }
  });

  const color = seg?.color ?? '#E8457A';
  const pkg = packages[cur];
  const pending = packages.filter(p => p.status === 'pending' || p.status === 'needs_edit').length;

  // Email preview HTML
  const emailPreviewHtml = useMemo(() => {
    if (!pkg) return '';
    return buildEmailHtml(pkg, color, '#');
  }, [pkg, color]);

  // Refs for keyboard handler
  const curRef = useRef(cur);
  curRef.current = cur;
  const pkgRef = useRef(pkg);
  pkgRef.current = pkg;
  const packagesRef = useRef(packages);
  packagesRef.current = packages;
  const editValuesRef = useRef(editValues);
  editValuesRef.current = editValues;

  const setStatus = useCallback((status: PackageStatus) => {
    const currentPkg = pkgRef.current;
    if (!currentPkg) return;
    actions.updatePackage(segmentId, currentPkg.id, { status });
    setEditing(false);
    setShowRejectDrop(false);
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

  // Reprompt handlers
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
      const updatedPkg = { ...currentPkg, ...updates };
      const flags = scanPackage(updatedPkg);
      updates.complianceFlags = flags;
      if (hasHardFlags(flags)) updates.status = 'needs_edit';
      actions.updatePackage(segmentId, currentPkg.id, updates);
      setRepromptInstruction('');
    } catch { /* stay in reprompt */ }
    finally { setRepromptLoading(null); }
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
      const updatedPkg = { ...currentPkg, ...updates };
      const flags = scanPackage(updatedPkg);
      updates.complianceFlags = flags;
      if (hasHardFlags(flags)) updates.status = 'needs_edit';
      actions.updatePackage(segmentId, currentPkg.id, updates);
      setRepromptInstruction('');
    } catch { /* stay */ }
    finally { setRepromptLoading(null); }
  }, [repromptInstruction, segmentId, actions]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') { setEditing(false); setEditValues({}); }
        return;
      }
      if (editing) {
        if (e.key === 'Escape') { setEditing(false); setEditValues({}); }
        return;
      }

      let used = false;
      if (e.key === 'a') { setStatus('approved'); used = true; }
      if (e.key === 'r') { setStatus('rejected'); used = true; }
      if (e.key === 'e') { setEditing(true); setEditValues({}); used = true; }
      if (e.key === 'ArrowRight' || e.key === 'j') { setCur(c => Math.min(c + 1, packagesRef.current.length - 1)); used = true; }
      if (e.key === 'ArrowLeft' || e.key === 'k') { setCur(c => Math.max(c - 1, 0)); used = true; }

      if (used) {
        setShortcutUseCount(c => {
          const next = c + 1;
          try { localStorage.setItem('folly-shortcut-count', String(next)); } catch {}
          return next;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editing, setStatus]);

  // All reviewed
  if (pending === 0 && packages.length > 0) {
    const approved = packages.filter(p => p.status === 'approved').length;
    const rejected = packages.filter(p => p.status === 'rejected').length;
    return (
      <div className="text-center py-[72px] max-w-[440px] mx-auto">
        <div className="w-[52px] h-[52px] rounded-full bg-success flex items-center justify-center mx-auto mb-4 text-[22px] text-white">
          <Check size={24} weight="bold" />
        </div>
        <h2 className="text-[22px] font-semibold mb-2">All packages reviewed</h2>
        <p className="text-neutral-500 text-sm mb-6">{approved} approved · {rejected} rejected</p>
        <button
          onClick={onComplete}
          className="px-7 py-3 rounded-[10px] border-none cursor-pointer text-white text-sm font-semibold bg-primary-500 hover:brightness-110 transition-[filter] inline-flex items-center gap-2"
        >
          Publish <ArrowRight size={14} weight="bold" />
        </button>
      </div>
    );
  }

  if (!pkg) return null;

  // Shimmer for loading
  const ShimmerBlock = ({ height }: { height: string }) => (
    <div className="rounded-[7px] overflow-hidden skeleton" style={{ height }} />
  );

  const statusColor = (s: PackageStatus) =>
    s === 'approved' ? 'var(--color-success)' : s === 'rejected' ? 'var(--color-error)' : s === 'needs_edit' ? 'var(--color-warning)' : 'var(--color-neutral-300)';

  return (
    <div className="flex gap-0 max-w-[1100px] mx-auto" style={{ minHeight: 'calc(100vh - 140px)' }}>
      {/* ═══ Left Sidebar — Package List ═══ */}
      <div className="w-[220px] flex-shrink-0 border-r border-neutral-200 pr-3 mr-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
        <div className="text-[10px] font-mono uppercase tracking-wide text-neutral-400 mb-2 px-1">
          Packages ({packages.length})
        </div>
        {packages.map((p, i) => (
          <div
            key={p.id}
            onClick={() => setCur(i)}
            className={`px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150 mb-0.5 ${
              i === cur ? 'bg-neutral-100' : 'hover:bg-neutral-100'
            }`}
            style={i === cur ? { borderLeft: `2px solid ${color}`, paddingLeft: 8 } : { borderLeft: '2px solid transparent', paddingLeft: 8 }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: statusColor(p.status) }}
              />
              <span className={`text-[12px] truncate ${i === cur ? 'text-neutral-800 font-medium' : 'text-neutral-500'}`}>
                {p.headline}
              </span>
            </div>
            {p.complianceFlags.length > 0 && (
              <div className="ml-3.5 mt-0.5 text-[9px] font-mono text-warning">
                {p.complianceFlags.filter(f => f.severity === 'hard').length > 0 ? '! compliance' : `${p.complianceFlags.length} flags`}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ═══ Main Content ═══ */}
      <div className="flex-1 min-w-0">
        {/* Compliance flags */}
        {pkg.complianceFlags.length > 0 && (
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {pkg.complianceFlags.map((flag, i) => (
              <span
                key={i}
                className="text-[11px] px-2.5 py-1 rounded-[6px] font-mono cursor-default"
                style={{
                  backgroundColor: flag.severity === 'hard' ? 'rgba(199,84,80,0.12)' : 'rgba(212,168,67,0.12)',
                  color: flag.severity === 'hard' ? 'var(--color-error)' : 'var(--color-warning)',
                }}
                title={flag.suggestion ?? ''}
              >
                {flag.message}
                {flag.suggestion && (
                  <span
                    className="ml-1 cursor-pointer hover:brightness-125 transition-[filter]"
                    style={{ color: flag.severity === 'hard' ? '#f0a0a0' : '#e8d088' }}
                    onClick={() => navigator.clipboard.writeText(flag.suggestion!)}
                  >
                    → fix
                  </span>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Source question */}
        <div className="text-[11px] text-neutral-400 mb-3">
          Answering: <em className="text-neutral-500">"{pkg.sourceQuestion}"</em>
        </div>

        {/* ═══ Split View: Blog + Email ═══ */}
        <div className="flex gap-4">
          {/* Blog */}
          <div className="flex-[55%] min-w-0 overflow-y-auto" style={{ maxHeight: 520 }}>
            <div className="text-[10px] text-neutral-400 font-mono tracking-wide uppercase mb-2">Blog</div>
            <div className="bg-white rounded-[10px] p-5 text-neutral-950">
              {/* Featured image placeholder */}
              <div
                className="w-full h-[80px] rounded-lg mb-3 flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${color}30, ${color}08)` }}
              >
                {pkg.blogImageUrl ? (
                  <span className="text-[9px] font-mono" style={{ color }}>FEATURED IMAGE</span>
                ) : (
                  <span className="text-[9px] font-mono text-error">IMAGE MISSING</span>
                )}
              </div>

              {repromptLoading === 'blog' ? (
                <div className="flex flex-col gap-3">
                  <ShimmerBlock height="24px" />
                  <ShimmerBlock height="12px" />
                  <ShimmerBlock height="80px" />
                </div>
              ) : editing ? (
                <>
                  <textarea
                    defaultValue={editValues.headline ?? pkg.headline}
                    onChange={e => setEditValues(prev => ({ ...prev, headline: e.target.value }))}
                    className="w-full text-lg font-serif border border-dashed border-neutral-400 rounded-md p-2 bg-neutral-50 resize-y min-h-[48px] leading-tight"
                  />
                  <div className="text-[11px] text-neutral-400 mb-2">By Luna Yu · {pkg.wordCount} words</div>
                  <textarea
                    defaultValue={editValues.blogBody ?? pkg.blogBody.replace(/<[^>]*>/g, '')}
                    onChange={e => setEditValues(prev => ({ ...prev, blogBody: `<p>${e.target.value}</p>` }))}
                    className="w-full text-[13px] border border-dashed border-neutral-400 rounded-md p-2 bg-neutral-50 resize-y min-h-[120px] leading-relaxed"
                  />
                </>
              ) : (
                <>
                  <h2 className="text-lg font-serif leading-tight mb-2">{pkg.headline}</h2>
                  <div className="text-[11px] text-neutral-400 mb-2">By Luna Yu · {pkg.wordCount} words</div>
                  <p className="text-[13px] leading-relaxed text-neutral-700">
                    {pkg.blogBody.replace(/<[^>]*>/g, '').substring(0, 400)}...
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="flex-[45%] min-w-0 overflow-y-auto" style={{ maxHeight: 520 }}>
            <div className="text-[10px] text-neutral-400 font-mono tracking-wide uppercase mb-2">Email</div>
            {!editing ? (
              <div className="rounded-[10px] overflow-hidden border border-neutral-200 bg-white" style={{ height: 460 }}>
                <iframe
                  srcDoc={emailPreviewHtml}
                  sandbox="allow-same-origin"
                  title="Email Preview"
                  className="w-full h-full border-none"
                  style={{ background: '#ffffff', display: 'block' }}
                />
              </div>
            ) : (
              <div className="bg-white rounded-[10px] text-neutral-950 overflow-hidden">
                <div className="p-3.5 bg-neutral-50 border-b border-neutral-100">
                  <input
                    defaultValue={editValues.subjectLine ?? pkg.subjectLine}
                    onChange={e => setEditValues(prev => ({ ...prev, subjectLine: e.target.value }))}
                    className="w-full text-xs font-semibold border border-dashed border-neutral-400 rounded p-1.5 bg-white"
                  />
                  <div className="text-[10px] text-neutral-400 text-right mt-0.5">
                    {(editValues.subjectLine ?? pkg.subjectLine).length}/50
                  </div>
                </div>
                <div className="p-3.5">
                  <textarea
                    defaultValue={editValues.emailBody ?? pkg.emailBody}
                    onChange={e => setEditValues(prev => ({ ...prev, emailBody: e.target.value }))}
                    className="w-full text-xs border border-dashed border-neutral-400 rounded p-2 bg-neutral-50 resize-y min-h-[80px] leading-relaxed"
                  />
                  <div className="text-center mt-3">
                    <div className="inline-block px-4 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-semibold">
                      {pkg.ctaText} →
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ Inline Reprompt — Always Visible ═══ */}
        {!editing && (
          <div className="mt-4 flex gap-2 items-center">
            <Sparkle size={14} style={{ color }} className="flex-shrink-0" />
            <input
              ref={repromptInputRef}
              type="text"
              value={repromptInstruction}
              onChange={e => setRepromptInstruction(e.target.value)}
              placeholder="Tweak with AI... e.g. 'Make it shorter and more urgent'"
              className="flex-1 px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200 text-neutral-900 text-[12px] placeholder:text-neutral-400 outline-none focus:border-neutral-400 transition-colors"
              disabled={repromptLoading !== null}
              onKeyDown={e => {
                if (e.key === 'Enter' && repromptInstruction.trim()) {
                  handleRepromptBlog();
                }
              }}
            />
            {repromptInstruction.trim() && (
              <div className="flex gap-1.5">
                <button
                  onClick={handleRepromptBlog}
                  disabled={repromptLoading !== null}
                  className="px-3 py-2 rounded-lg border-none text-white text-[11px] font-semibold cursor-pointer disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: color }}
                >
                  {repromptLoading === 'blog' ? '...' : 'Blog'}
                </button>
                <button
                  onClick={handleRepromptEmail}
                  disabled={repromptLoading !== null}
                  className="px-3 py-2 rounded-lg border-none text-white text-[11px] font-semibold cursor-pointer disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: color }}
                >
                  {repromptLoading === 'email' ? '...' : 'Email'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══ Action Bar ═══ */}
        <div className="flex justify-center gap-2.5 mt-5">
          {editing ? (
            <>
              <button
                onClick={() => { setEditing(false); setEditValues({}); }}
                className="px-5 py-2.5 rounded-lg border border-neutral-200 bg-transparent text-neutral-600 text-[13px] cursor-pointer flex items-center gap-1.5"
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
              {/* Skip (just navigate forward) */}
              <button
                onClick={() => setCur(c => Math.min(c + 1, packages.length - 1))}
                className="px-5 py-2.5 rounded-lg border border-neutral-200 bg-transparent text-neutral-500 text-[13px] cursor-pointer flex items-center gap-1.5 hover:text-neutral-700 hover:border-neutral-300 transition-colors"
              >
                Skip <Kbd>→</Kbd>
              </button>

              {/* Edit */}
              <button
                onClick={() => { setEditing(true); setEditValues({}); }}
                className="px-5 py-2.5 rounded-lg border border-neutral-200 bg-transparent text-neutral-600 text-[13px] font-semibold cursor-pointer flex items-center gap-1.5"
              >
                <PencilSimpleLine size={14} /> Edit <Kbd>E</Kbd>
              </button>

              {/* Approve */}
              <button
                onClick={() => setStatus('approved')}
                className="px-7 py-2.5 rounded-lg border-none bg-success text-white text-[13px] font-semibold cursor-pointer flex items-center gap-1.5"
              >
                <Check size={14} weight="bold" /> Approve <Kbd>A</Kbd>
              </button>

              {/* Reject (dropdown) */}
              <div className="relative">
                <button
                  onClick={() => setShowRejectDrop(!showRejectDrop)}
                  className="px-2.5 py-2.5 rounded-lg border border-neutral-200 bg-transparent text-neutral-400 text-[13px] cursor-pointer hover:text-neutral-600 hover:border-neutral-300 transition-colors"
                >
                  <CaretDown size={12} />
                </button>
                {showRejectDrop && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                    <button
                      onClick={() => setStatus('rejected')}
                      className="w-full text-left px-3 py-2 text-[12px] text-error bg-transparent border-none cursor-pointer hover:bg-neutral-100 transition-colors flex items-center gap-2"
                    >
                      <X size={12} /> Reject <Kbd>R</Kbd>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Batch approve */}
        {!editing && pending >= 3 && (
          <div className="flex justify-center mt-2.5">
            <button
              onClick={() => {
                if (batchConfirm) {
                  for (const p of packages) {
                    if (p.status === 'pending' || p.status === 'needs_edit') {
                      actions.updatePackage(segmentId, p.id, { status: 'approved' });
                    }
                  }
                  setBatchConfirm(false);
                } else {
                  setBatchConfirm(true);
                }
              }}
              onBlur={() => setBatchConfirm(false)}
              className="px-4 py-1.5 rounded-lg border border-neutral-200 bg-transparent text-neutral-400 text-[11px] cursor-pointer hover:text-neutral-600 hover:border-neutral-300 transition-colors"
            >
              {batchConfirm ? 'Click again to confirm' : `Approve all ${pending} remaining`}
            </button>
          </div>
        )}

        {/* Keyboard shortcut hints — fade after 3 uses */}
        {shortcutUseCount < 6 && !editing && (
          <div className="text-center mt-3 text-[11px] text-neutral-400 transition-opacity" style={{ opacity: Math.max(0.3, 1 - shortcutUseCount * 0.15) }}>
            ← → navigate · A approve · E edit · R reject
          </div>
        )}
      </div>
    </div>
  );
}
