import { emailTemplate } from './config';
import type { ContentPackage } from './types';

/**
 * Injects content package data into the Klaviyo email HTML template.
 * Replaces all {{SLOT}} markers with actual content.
 */
export function buildEmailHtml(
  pkg: ContentPackage,
  segmentColor: string,
  blogUrl: string,
): string {
  let html = emailTemplate;

  const replacements: Record<string, string> = {
    '{{HEADLINE}}': pkg.headline,
    '{{HERO_IMAGE_URL}}': pkg.emailImageUrl ?? 'https://placehold.co/600x400/FFF0F6/E8457A?text=Folly',
    '{{HERO_IMAGE_ALT}}': `${pkg.headline} - Folly Nutrition`,
    '{{BODY_TEXT}}': pkg.emailBody,
    '{{CTA_TEXT}}': pkg.ctaText.toUpperCase(),
    '{{CTA_URL}}': blogUrl,
    '{{SEGMENT_COLOR}}': segmentColor,
    '{{PREVIEW_TEXT}}': pkg.previewText,
  };

  for (const [slot, value] of Object.entries(replacements)) {
    html = html.replaceAll(slot, value);
  }

  return html;
}

/**
 * Builds email HTML for all approved packages in a segment.
 * Returns an array of { packageId, subject, html, blogUrl } objects.
 */
export function buildAllEmailHtml(
  packages: ContentPackage[],
  segmentColor: string,
  blogBaseUrl: string,
): { packageId: string; subject: string; html: string; blogUrl: string }[] {
  return packages
    .filter(p => p.status === 'approved')
    .map(pkg => {
      const handle = pkg.headline
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+$/, '');
      const blogUrl = `${blogBaseUrl}${handle}`;
      return {
        packageId: pkg.id,
        subject: pkg.subjectLine,
        html: buildEmailHtml(pkg, segmentColor, blogUrl),
        blogUrl,
      };
    });
}
