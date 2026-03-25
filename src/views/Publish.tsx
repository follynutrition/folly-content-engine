import { useState } from 'react';
import { useStoreState, useActions } from '@/lib/store';
import { getSegment, brandConstants } from '@/lib/config';
import { Rocket, DownloadSimple, CheckCircle, XCircle, CaretDown, CaretUp, Confetti } from '@phosphor-icons/react';

interface PublishProps {
  segmentId: string;
  onComplete: () => void;
}

const SEND_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export function Publish({ segmentId, onComplete }: PublishProps) {
  const state = useStoreState();
  const actions = useActions();
  const seg = getSegment(segmentId);
  const segState = state.runs[state.activeRunId]?.segments[segmentId];
  const packages = (segState?.packages ?? []).filter(p => p.status === 'approved');

  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [blogBaseUrl, setBlogBaseUrl] = useState(brandConstants.blog_base_url);
  const [_celebrateVisible, setCelebrateVisible] = useState(false);

  const color = seg?.color ?? '#E8457A';
  const sendTime = seg?.default_send_time ?? '08:00';
  const receipt = segState?.publishReceipt;

  // Export CSV
  const exportCsv = () => {
    const headers = ['Title', 'Body HTML', 'Author', 'Tags', 'Meta Title', 'Meta Description', 'Published', 'Image Src'];
    const rows = packages.map(p => [
      p.headline,
      p.blogBody,
      brandConstants.blog_author,
      p.blogTags.join(', '),
      p.metaTitle,
      p.metaDescription,
      new Date().toISOString(),
      p.blogImageUrl ?? '',
    ]);
    const csv = [headers, ...rows].map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `folly-${segmentId}-blogs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Publish simulation
  const publish = () => {
    setPublishing(true);
    let p = 0;
    const interval = setInterval(() => {
      p += 8;
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        const publishReceipt = {
          blogs: packages.map(pkg => ({
            packageId: pkg.id,
            title: pkg.headline,
            url: `${blogBaseUrl}${pkg.headline.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}`,
            status: Math.random() > 0.1 ? 'live' as const : 'failed' as const,
          })),
          campaigns: packages.map((pkg, i) => ({
            packageId: pkg.id,
            subject: pkg.subjectLine,
            klaviyoId: `KLV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            sendDate: `${SEND_DAYS[i % 5]} ${sendTime}`,
            status: Math.random() > 0.15 ? 'scheduled' as const : 'failed' as const,
          })),
        };
        actions.setPublishReceipt(segmentId, publishReceipt);
        setPublishing(false);
        setCelebrateVisible(true);
      }
    }, 200);
  };

  // Receipt view (after publishing)
  if (receipt) {
    const failedBlogs = receipt.blogs.filter(b => b.status === 'failed');
    const failedCampaigns = receipt.campaigns.filter(c => c.status === 'failed');
    const liveBlogs = receipt.blogs.filter(b => b.status === 'live').length;
    const scheduledCampaigns = receipt.campaigns.filter(c => c.status === 'scheduled').length;
    const hasFailed = failedBlogs.length > 0 || failedCampaigns.length > 0;

    return (
      <div className="max-w-[700px] mx-auto">
        {/* Celebration header */}
        <div className="text-center mb-8 animate-in">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: `${color}10` }}
          >
            <Confetti size={32} weight="duotone" style={{ color }} />
          </div>
          <h2 className="text-2xl font-semibold mb-1">{seg?.name} is live!</h2>
          <p className="text-neutral-500 text-sm">
            {liveBlogs} blog{liveBlogs !== 1 ? 's' : ''} published · {scheduledCampaigns} campaign{scheduledCampaigns !== 1 ? 's' : ''} scheduled
          </p>
        </div>

        {/* Failed items — show first if any */}
        {hasFailed && (
          <div className="mb-5 p-4 rounded-xl border border-error/20 bg-error/5">
            <div className="text-sm font-semibold text-error mb-2">Some items need attention</div>
            {failedBlogs.map(blog => (
              <div key={blog.packageId} className="flex items-center justify-between py-1.5 text-[12px]">
                <span className="text-neutral-600 truncate flex-1">{blog.title}</span>
                <span className="text-error font-mono text-[10px] flex items-center gap-1 ml-2">
                  <XCircle size={12} /> Blog failed
                </span>
              </div>
            ))}
            {failedCampaigns.map(c => (
              <div key={c.packageId} className="flex items-center justify-between py-1.5 text-[12px]">
                <span className="text-neutral-600 truncate flex-1">{c.subject}</span>
                <span className="text-error font-mono text-[10px] flex items-center gap-1 ml-2">
                  <XCircle size={12} /> Campaign failed
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Success items */}
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="text-[10px] text-neutral-400 font-mono tracking-wide uppercase mb-2">Blogs</div>
            {receipt.blogs.filter(b => b.status === 'live').map(blog => (
              <div key={blog.packageId} className="bg-white rounded-lg border border-neutral-200 p-2.5 px-3 mb-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-neutral-800 flex-1 truncate">{blog.title}</span>
                  <span className="text-[10px] font-mono text-success flex items-center gap-1 flex-shrink-0 ml-2">
                    <CheckCircle size={12} /> live
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex-1">
            <div className="text-[10px] text-neutral-400 font-mono tracking-wide uppercase mb-2">Campaigns</div>
            {receipt.campaigns.filter(c => c.status === 'scheduled').map(c => (
              <div key={c.packageId} className="bg-white rounded-lg border border-neutral-200 p-2.5 px-3 mb-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-neutral-800 flex-1 truncate">{c.subject}</span>
                  <span className="text-[10px] font-mono text-success flex items-center gap-1 flex-shrink-0 ml-2">
                    <CheckCircle size={12} /> {c.sendDate}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-8">
          <button
            onClick={onComplete}
            className="px-7 py-3 rounded-xl border-none cursor-pointer text-white text-sm font-semibold bg-primary-500 hover:brightness-110 transition-[filter]"
          >
            Back to Run Home
          </button>
        </div>
      </div>
    );
  }

  // Publishing progress
  if (publishing) {
    return (
      <div className="text-center py-20 max-w-[360px] mx-auto">
        <Rocket size={40} className="mx-auto mb-4 text-neutral-600" weight="duotone" />
        <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden mb-2.5">
          <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${progress}%`, backgroundColor: color }} />
        </div>
        <div className="text-[13px] text-neutral-500">
          {progress < 50 ? 'Importing blogs to Shopify...' : 'Creating Klaviyo campaigns...'}
        </div>
      </div>
    );
  }

  // ═══ Main publish screen — single page ═══
  return (
    <div className="max-w-[600px] mx-auto py-6">
      <div className="text-center mb-8">
        <Rocket size={40} className="mx-auto mb-3 text-neutral-600" weight="duotone" />
        <h2 className="text-xl font-semibold mb-1">Ready to publish {seg?.name}</h2>
        <p className="text-neutral-500 text-sm">
          {packages.length} blogs → Shopify · {packages.length} campaigns → Klaviyo
        </p>
      </div>

      {/* Schedule table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden mb-5">
        <div className="px-4 py-2.5 border-b border-neutral-200 flex items-center justify-between">
          <span className="text-[10px] text-neutral-400 font-mono uppercase tracking-wide">Send Schedule</span>
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 text-[11px] text-neutral-500 bg-transparent border-none cursor-pointer hover:text-neutral-700 transition-colors"
          >
            <DownloadSimple size={12} /> Export CSV
          </button>
        </div>
        {packages.map((pkg, i) => (
          <div key={pkg.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-100 last:border-b-0">
            <span className="text-xs font-mono w-8 font-semibold" style={{ color }}>{SEND_DAYS[i % 5]}</span>
            <span className="text-[11px] text-neutral-400 w-[45px]">{sendTime}</span>
            <span className="text-xs text-neutral-700 flex-1 truncate">{pkg.subjectLine}</span>
          </div>
        ))}
      </div>

      {/* Advanced: Blog URL (collapsed by default) */}
      <div className="mb-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-[11px] text-neutral-400 bg-transparent border-none cursor-pointer hover:text-neutral-600 transition-colors"
        >
          {showAdvanced ? <CaretUp size={10} /> : <CaretDown size={10} />}
          Advanced settings
        </button>
        {showAdvanced && (
          <div className="mt-2 animate-in">
            <label className="text-[11px] text-neutral-400 mb-1 block">Blog base URL</label>
            <input
              type="text"
              value={blogBaseUrl}
              onChange={e => setBlogBaseUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200 text-neutral-900 text-sm font-mono focus:border-neutral-400 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Publish button */}
      <div className="text-center">
        <button
          onClick={publish}
          className="px-8 py-3.5 rounded-xl border-none cursor-pointer text-white text-sm font-semibold hover:brightness-110 transition-all inline-flex items-center gap-2"
          style={{ backgroundColor: color }}
        >
          <Rocket size={16} weight="fill" /> Publish {packages.length} Packages
        </button>
      </div>
    </div>
  );
}
