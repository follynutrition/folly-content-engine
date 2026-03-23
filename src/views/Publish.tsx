import { useState } from 'react';
import { useStoreState, useActions } from '@/lib/store';
import { getSegment, brandConstants, scheduleDefaults } from '@/lib/config';
import { Rocket, DownloadSimple, CheckCircle, XCircle } from '@phosphor-icons/react';

interface PublishProps {
  segmentId: string;
  onComplete: () => void;
}

type PublishStep = 'preview' | 'blog_url' | 'publishing' | 'receipt';

const SEND_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export function Publish({ segmentId, onComplete }: PublishProps) {
  const state = useStoreState();
  const actions = useActions();
  const seg = getSegment(segmentId);
  const segState = state.runs[state.activeRunId]?.segments[segmentId];
  const packages = (segState?.packages ?? []).filter(p => p.status === 'approved');

  const [step, setStep] = useState<PublishStep>('preview');
  const [progress, setProgress] = useState(0);
  const [blogBaseUrl, setBlogBaseUrl] = useState(brandConstants.blog_base_url);

  const color = seg?.color ?? '#E8457A';
  const sendTime = seg?.default_send_time ?? '08:00';

  // Export Matrixify CSV
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

  // Simulate publishing
  const publish = () => {
    setStep('publishing');
    let p = 0;
    const interval = setInterval(() => {
      p += 8;
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);

        // Create publish receipt
        const receipt = {
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

        actions.setPublishReceipt(segmentId, receipt);
        setStep('receipt');
      }
    }, 200);
  };

  // Receipt view
  if (step === 'receipt') {
    const receipt = segState?.publishReceipt;
    if (!receipt) return null;

    const failedBlogs = receipt.blogs.filter(b => b.status === 'failed');
    const failedCampaigns = receipt.campaigns.filter(c => c.status === 'failed');

    return (
      <div className="max-w-[700px] mx-auto">
        <div className="text-center mb-7">
          <Rocket size={40} className="mx-auto mb-3 text-primary-500" weight="duotone" />
          <h2 className="text-[22px] font-semibold mb-1">{seg?.name} Published</h2>
          <p className="text-neutral-500 text-sm">
            {receipt.blogs.length} blogs · {receipt.campaigns.length} campaigns · {scheduleDefaults.send_days.slice(0, packages.length).join('–')} {sendTime}
          </p>
        </div>

        <div className="flex gap-4">
          {/* Blogs */}
          <div className="flex-1">
            <div className="text-[10px] text-neutral-600 font-mono tracking-wide uppercase mb-2">
              Blogs on Shopify
            </div>
            {[...failedBlogs, ...receipt.blogs.filter(b => b.status === 'live')].map(blog => (
              <div key={blog.packageId} className="bg-neutral-800 rounded-[10px] border border-neutral-700 p-2.5 px-3 mb-1">
                <div className="flex justify-between items-center">
                  <div className="text-xs text-neutral-50 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {blog.title}
                  </div>
                  <span className="text-[10px] font-mono shrink-0 ml-2 flex items-center gap-1" style={{ color: blog.status === 'live' ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {blog.status === 'live' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {blog.status}
                  </span>
                </div>
                <div className="text-[10px] text-neutral-600 font-mono mt-[3px] overflow-hidden text-ellipsis whitespace-nowrap">
                  {blog.url}
                </div>
              </div>
            ))}
          </div>

          {/* Campaigns */}
          <div className="flex-1">
            <div className="text-[10px] text-neutral-600 font-mono tracking-wide uppercase mb-2">
              Campaigns in Klaviyo
            </div>
            {[...failedCampaigns, ...receipt.campaigns.filter(c => c.status === 'scheduled')].map(campaign => (
              <div key={campaign.packageId} className="bg-neutral-800 rounded-[10px] border border-neutral-700 p-2.5 px-3 mb-1">
                <div className="flex justify-between items-center">
                  <div className="text-xs text-neutral-50 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    ✉ {campaign.subject}
                  </div>
                  <span className="text-[10px] font-mono shrink-0 ml-2 flex items-center gap-1" style={{ color: campaign.status === 'scheduled' ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {campaign.status === 'scheduled' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {campaign.status}
                  </span>
                </div>
                <div className="text-[10px] text-neutral-600 mt-[3px]">
                  {campaign.sendDate} · {seg?.name} segment
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-8">
          <button
            onClick={onComplete}
            className="px-7 py-3 rounded-[10px] border-none cursor-pointer text-white text-sm font-semibold bg-primary-500 hover:brightness-110 transition-[filter]"
          >
            ← Back to Run Home
          </button>
        </div>
      </div>
    );
  }

  // Publishing progress
  if (step === 'publishing') {
    return (
      <div className="text-center py-20 max-w-[360px] mx-auto">
        <Rocket size={40} className="mx-auto mb-4 opacity-80 text-neutral-300" weight="duotone" />
        <div className="w-full h-1.5 bg-neutral-800 rounded-[3px] overflow-hidden mb-2.5">
          <div className="h-full rounded-[3px] transition-[width] duration-200" style={{ width: `${progress}%`, backgroundColor: color }} />
        </div>
        <div className="text-[13px] text-neutral-500">
          {progress < 50 ? 'Importing blogs to Shopify...' : 'Creating Klaviyo campaigns...'}
        </div>
      </div>
    );
  }

  // Blog URL step
  if (step === 'blog_url') {
    return (
      <div className="max-w-[500px] mx-auto text-center py-10">
        <h2 className="text-xl font-semibold mb-2">Enter Blog Base URL</h2>
        <p className="text-neutral-500 text-sm mb-6">
          After Matrixify import, confirm the Shopify blog URL pattern.
          The app will construct individual URLs from handles.
        </p>
        <input
          type="text"
          value={blogBaseUrl}
          onChange={e => setBlogBaseUrl(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg bg-neutral-800 border border-neutral-600 text-neutral-50 text-sm font-mono focus:border-primary-500 focus:outline-none mb-6"
          placeholder="https://follynutrition.com/blogs/journal/"
        />
        <button
          onClick={publish}
          className="px-7 py-3 rounded-[10px] border-none cursor-pointer text-white text-sm font-semibold hover:brightness-110 transition-[filter]"
          style={{ backgroundColor: color }}
        >
          Create Klaviyo Campaigns →
        </button>
      </div>
    );
  }

  // Schedule preview (default)
  return (
    <div className="max-w-[560px] mx-auto text-center py-10">
      <Rocket size={40} className="mx-auto mb-4 opacity-80 text-neutral-300" weight="duotone" />
      <h2 className="text-[22px] font-semibold mb-1.5">Ready to publish {seg?.name}</h2>
      <p className="text-neutral-500 text-sm leading-relaxed mb-2">
        {packages.length} blogs → Shopify via Matrixify<br />
        {packages.length} campaigns → Klaviyo via MCP
      </p>

      {/* Export CSV button */}
      <button
        onClick={exportCsv}
        className="mx-auto mb-6 px-4 py-2 rounded-lg border border-neutral-700 bg-transparent text-neutral-300 text-xs cursor-pointer flex items-center gap-1.5 hover:border-neutral-500 transition-colors"
      >
        <DownloadSimple size={14} /> Export Matrixify CSV
      </button>

      {/* Schedule */}
      <div className="text-[10px] text-neutral-600 font-mono tracking-wide uppercase mb-2 text-left">
        Schedule
      </div>
      <div className="text-left">
        {packages.map((pkg, i) => (
          <div key={pkg.id} className="flex items-center gap-2.5 py-2 border-b border-neutral-800">
            <span className="text-xs font-mono w-10" style={{ color }}>{SEND_DAYS[i % 5]}</span>
            <span className="text-xs text-neutral-500 w-[50px]">{sendTime}</span>
            <span className="text-xs text-neutral-50 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
              ✉ {pkg.subjectLine}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={() => setStep('blog_url')}
        className="mt-7 px-7 py-3 rounded-[10px] border-none cursor-pointer text-white text-sm font-semibold hover:brightness-110 transition-[filter]"
        style={{ backgroundColor: color }}
      >
        Publish {seg?.name} →
      </button>
    </div>
  );
}
