import type { ContentPackage, ComplianceFlag } from '@/lib/types';
import { complianceRules } from '@/lib/config';
import { stripHtml } from '@/lib/utils';

// Map rule field names to ContentPackage property accessors
function getFieldValue(pkg: ContentPackage, field: string): string {
  switch (field) {
    case 'blog_body': return stripHtml(pkg.blogBody);
    case 'blog_headline': return pkg.headline;
    case 'email_body': return pkg.emailBody;
    case 'meta_description': return pkg.metaDescription;
    case 'subject_line': return pkg.subjectLine;
    case 'preview_text': return pkg.previewText;
    case 'meta_title': return pkg.metaTitle;
    default: return '';
  }
}

/**
 * Extract 4–5 word phrases from text for payoff leak detection.
 */
function extractPhrases(text: string, minLength: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const phrases: string[] = [];
  for (let len = 4; len <= 5; len++) {
    for (let i = 0; i <= words.length - len; i++) {
      const phrase = words.slice(i, i + len).join(' ');
      if (phrase.length >= minLength) {
        phrases.push(phrase);
      }
    }
  }
  return phrases;
}

/**
 * Scan a content package against all compliance rules.
 * Returns an array of ComplianceFlag objects for every violation found.
 */
export function scanPackage(pkg: ContentPackage): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];

  // Hard flag suggestion lookup
  const hardSuggestions: Record<string, string> = {
    'medical-regrowth': "Replace with 'hair health' or 'hair strength'",
    'medical-treats': "Replace with 'supports' or 'promotes'",
    'medical-clinically-proven': "Replace with 'Clinically Studied'",
    'competitor-name-in-blog': 'Remove competitor name from blog body',
    'medical-diagnosis': "Remove or add 'talk to your doctor'",
  };

  // 1. Hard flags — regex patterns
  for (const rule of complianceRules.hard_flags.rules) {
    const regex = new RegExp(rule.pattern, rule.case_sensitive ? 'g' : 'gi');
    for (const field of rule.applies_to) {
      const value = getFieldValue(pkg, field);
      if (!value) continue;
      const matches = value.matchAll(regex);
      for (const m of matches) {
        flags.push({
          id: rule.id,
          severity: 'hard',
          field,
          message: rule.message.replace('{{match}}', m[0]),
          match: m[0],
          suggestion: hardSuggestions[rule.id],
        });
      }
    }
  }

  // 2. Soft flags — char_count and word_count checks
  for (const rule of complianceRules.soft_flags.rules) {
    const value = getFieldValue(pkg, rule.field);
    if (!value) continue;

    if (rule.type === 'char_count') {
      const count = value.length;
      if (rule.max !== undefined && count > rule.max) {
        flags.push({
          id: rule.id,
          severity: 'soft',
          field: rule.field,
          message: rule.message.replace('{{count}}', String(count)),
          suggestion: `Reduce to ${rule.max} characters`,
        });
      }
    } else if (rule.type === 'word_count') {
      const count = value.trim().split(/\s+/).filter(Boolean).length;
      if (rule.max !== undefined && count > rule.max) {
        flags.push({
          id: rule.id,
          severity: 'soft',
          field: rule.field,
          message: rule.message.replace('{{count}}', String(count)),
          suggestion: `Reduce to ${rule.max} words`,
        });
      }
      if (rule.min !== undefined && count < rule.min) {
        flags.push({
          id: rule.id,
          severity: 'soft',
          field: rule.field,
          message: rule.message.replace('{{count}}', String(count)),
          suggestion: `Expand to at least ${rule.min} words`,
        });
      }
    }
  }

  // 3. AI slop flags — case-insensitive phrase matching
  const slopConfig = complianceRules.ai_slop_flags;
  for (const phrase of slopConfig.phrases) {
    const lowerPhrase = phrase.toLowerCase();
    for (const field of slopConfig.applies_to) {
      const value = getFieldValue(pkg, field);
      if (!value) continue;
      if (value.toLowerCase().includes(lowerPhrase)) {
        flags.push({
          id: `slop-${phrase.toLowerCase().replace(/\s+/g, '-')}`,
          severity: 'slop',
          field,
          message: slopConfig.message.replace('{{match}}', phrase),
          match: phrase,
          suggestion: "Rewrite in Luna's natural voice",
        });
      }
    }
  }

  // Brand flag suggestion lookup
  const brandSuggestions: Record<string, string> = {
    'urgency-language': 'Remove pressure language — Folly uses education, not urgency',
    'cancel-anytime': "Remove 'cancel anytime' — brand rule",
    'percentage-off': 'Use $1 first month framing instead of discounts',
  };

  // 4. Brand flags — regex patterns
  for (const rule of complianceRules.brand_flags.rules) {
    const regex = new RegExp(rule.pattern, rule.case_sensitive ? 'g' : 'gi');
    for (const field of rule.applies_to) {
      const value = getFieldValue(pkg, field);
      if (!value) continue;
      const matches = value.matchAll(regex);
      for (const m of matches) {
        flags.push({
          id: rule.id,
          severity: 'brand',
          field,
          message: rule.message.replace('{{match}}', m[0]),
          match: m[0],
          suggestion: brandSuggestions[rule.id] ?? 'Review brand guidelines',
        });
      }
    }
  }

  // 5. Payoff leak check
  const leakConfig = complianceRules.payoff_leak_check;
  if (leakConfig.enabled) {
    const blogText = getFieldValue(pkg, 'blog_body');
    const emailText = getFieldValue(pkg, 'email_body');
    if (blogText && emailText) {
      const phrases = extractPhrases(blogText, leakConfig.min_phrase_length);
      const emailLower = emailText.toLowerCase();
      for (const phrase of phrases) {
        if (emailLower.includes(phrase.toLowerCase())) {
          flags.push({
            id: 'payoff-leak',
            severity: 'payoff_leak',
            field: 'email_body',
            message: leakConfig.message.replace('{{match}}', phrase),
            match: phrase,
            suggestion: 'Rephrase the email teaser to hint without revealing the blog payoff',
          });
          // One payoff leak flag is enough signal
          break;
        }
      }
    }
  }

  return flags;
}

/**
 * Returns true if any flag has severity 'hard'.
 */
export function hasHardFlags(flags: ComplianceFlag[]): boolean {
  return flags.some(f => f.severity === 'hard');
}
