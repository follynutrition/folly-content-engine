import type { EmotionTag } from './types';

export function emotionColor(emotion: EmotionTag): string {
  if (['scared', 'panicked', 'desperate'].includes(emotion)) return 'var(--color-error)';
  if (['frustrated', 'angry'].includes(emotion)) return 'var(--color-warning)';
  if (['hopeful', 'seeking'].includes(emotion)) return 'var(--color-success)';
  return 'var(--color-neutral-500)';
}

export function emotionBgClass(emotion: EmotionTag): string {
  if (['scared', 'panicked', 'desperate'].includes(emotion)) return 'bg-error/12';
  if (['frustrated', 'angry'].includes(emotion)) return 'bg-warning/12';
  if (['hopeful', 'seeking'].includes(emotion)) return 'bg-success/12';
  return 'bg-neutral-500/10';
}

export function segmentColorVar(segId: string): string {
  const map: Record<string, string> = {
    glp1: 'var(--color-seg-glp1)',
    postpartum: 'var(--color-seg-postpartum)',
    perimeno: 'var(--color-seg-perimeno)',
    pillfatigue: 'var(--color-seg-pillfatigue)',
  };
  return map[segId] ?? 'var(--color-primary-500)';
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent ?? '';
}
