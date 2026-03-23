import type { ResearchResult } from './types';

const glp1Results: ResearchResult[] = [
  { source: 'r/Ozempic', question: 'Is anyone else losing hair at month 3? I\'m freaking out', votes: 847, emotion: 'scared', trending: true },
  { source: 'r/semaglutide', question: 'My dermatologist said hair loss is from rapid weight loss, not the drug — true?', votes: 623, emotion: 'confused', trending: false },
  { source: 'r/tirzepatide', question: 'Started Mounjaro 6 weeks ago and my ponytail is half the size it used to be', votes: 512, emotion: 'panicked', trending: true },
  { source: 'r/Ozempic', question: 'Has anyone found a supplement that actually helped with shedding on Ozempic?', votes: 394, emotion: 'seeking', trending: false },
  { source: 'r/semaglutide', question: 'Doctor says take biotin but it\'s doing nothing — 4 months in', votes: 338, emotion: 'frustrated', trending: false },
  { source: 'r/GLP1', question: 'I\'m terrified to start semaglutide because of the hair loss stories', votes: 276, emotion: 'anxious', trending: false },
  { source: 'Google PAA', question: 'How long does GLP-1 hair loss last?', votes: null, emotion: 'anxious', trending: false },
  { source: 'Google PAA', question: 'Can you prevent hair loss on Ozempic?', votes: null, emotion: 'seeking', trending: false },
  { source: 'r/Ozempic', question: 'My hair started growing back after I added protein and iron — sharing what worked', votes: 1203, emotion: 'hopeful', trending: true },
  { source: 'Google PAA', question: 'What vitamins should I take for semaglutide hair loss?', votes: null, emotion: 'seeking', trending: false },
  { source: 'r/tirzepatide', question: 'Is the shedding from nutrient deficiency or the drug itself? Conflicting info everywhere', votes: 445, emotion: 'confused', trending: false },
  { source: 'r/semaglutide', question: 'Hair loss was my last straw — almost quit semaglutide over it', votes: 289, emotion: 'desperate', trending: false },
];

const postpartumResults: ResearchResult[] = [
  { source: 'r/beyondthebump', question: 'I\'m 4 months postpartum and clumps are falling out in the shower — is this normal??', votes: 932, emotion: 'scared', trending: true },
  { source: 'r/postpartum', question: 'When does postpartum shedding actually stop? I\'m at 6 months and it\'s worse', votes: 671, emotion: 'anxious', trending: true },
  { source: 'r/breastfeeding', question: 'Is breastfeeding making my hair loss worse? Scared to wean but scared to keep going', votes: 445, emotion: 'confused', trending: false },
  { source: 'r/beyondthebump', question: 'My hairstylist said my hair is half the density it was before pregnancy', votes: 387, emotion: 'panicked', trending: false },
  { source: 'r/newparents', question: 'Any new moms find supplements that actually helped with the shedding?', votes: 356, emotion: 'seeking', trending: false },
  { source: 'Google PAA', question: 'How long does postpartum hair loss last?', votes: null, emotion: 'anxious', trending: false },
  { source: 'r/postpartum', question: 'I tried Nutrafol postpartum and it upset my stomach — alternatives?', votes: 298, emotion: 'frustrated', trending: false },
  { source: 'r/beyondthebump', question: 'The baby hairs growing back are so frizzy and short — will they ever look normal?', votes: 267, emotion: 'worried', trending: false },
  { source: 'Google PAA', question: 'Are hair loss supplements safe while breastfeeding?', votes: null, emotion: 'anxious', trending: false },
  { source: 'r/breastfeeding', question: 'Doctor said postpartum loss peaks at 3-4 months but mine started at 6 — anyone else?', votes: 523, emotion: 'scared', trending: true },
  { source: 'Google PAA', question: 'What causes postpartum hair loss to get worse?', votes: null, emotion: 'confused', trending: false },
  { source: 'r/newparents', question: 'Finally seeing regrowth at 9 months — there IS a light at the end of the tunnel', votes: 814, emotion: 'hopeful', trending: false },
];

const perimenoResults: ResearchResult[] = [
  { source: 'r/menopause', question: 'My hair is thinning at the crown and I can see my scalp now — I\'m only 45', votes: 756, emotion: 'scared', trending: true },
  { source: 'r/perimenopause', question: 'Does HRT help with hair thinning or make it worse? Getting conflicting answers', votes: 634, emotion: 'confused', trending: true },
  { source: 'r/PCOS', question: 'Losing hair from PCOS and spironolactone isn\'t helping — what else is there?', votes: 489, emotion: 'frustrated', trending: false },
  { source: 'r/thyroid', question: 'TSH is "normal" but still losing hair — anyone else told it\'s in their head?', votes: 421, emotion: 'angry', trending: false },
  { source: 'r/menopause', question: 'Tried every supplement on the market and my hair just keeps getting thinner', votes: 378, emotion: 'desperate', trending: false },
  { source: 'Google PAA', question: 'Can perimenopause cause sudden hair loss?', votes: null, emotion: 'anxious', trending: false },
  { source: 'r/perimenopause', question: 'Is hair loss from perimenopause reversible or is this permanent?', votes: 567, emotion: 'scared', trending: true },
  { source: 'Google PAA', question: 'Best vitamins for menopause hair loss', votes: null, emotion: 'seeking', trending: false },
  { source: 'r/PCOS', question: 'My endo said my androgens are elevated and that\'s causing the shedding — now what?', votes: 312, emotion: 'worried', trending: false },
  { source: 'r/thyroid', question: 'Finally got my iron and vitamin D up and seeing new growth after 8 months', votes: 687, emotion: 'hopeful', trending: false },
  { source: 'Google PAA', question: 'Does estrogen decline cause hair loss in women?', votes: null, emotion: 'confused', trending: false },
  { source: 'r/menopause', question: 'I feel like I\'m grieving my hair — does anyone else feel this way?', votes: 892, emotion: 'desperate', trending: true },
];

const pillfatigueResults: ResearchResult[] = [
  { source: 'r/FemaleHairLoss', question: 'Took Nutrafol for 8 months and saw zero difference — $80/month wasted', votes: 723, emotion: 'frustrated', trending: true },
  { source: 'r/Supplements', question: 'Are hair supplements actually backed by science or is it all marketing?', votes: 612, emotion: 'confused', trending: true },
  { source: 'r/Nutrafol', question: 'Viviscal gave me terrible breakouts — anyone else have this reaction?', votes: 445, emotion: 'angry', trending: false },
  { source: 'r/HairLoss', question: 'I\'ve tried biotin, collagen, Nutrafol, and Viviscal — nothing works. What am I missing?', votes: 534, emotion: 'desperate', trending: true },
  { source: 'r/FemaleHairLoss', question: 'Sick of taking 6 pills a day for hair — there has to be a better way', votes: 389, emotion: 'frustrated', trending: false },
  { source: 'Google PAA', question: 'What is the most effective hair supplement for women?', votes: null, emotion: 'seeking', trending: false },
  { source: 'r/Supplements', question: 'My naturopath said most hair supplements are underdosed — how do you know what\'s enough?', votes: 298, emotion: 'confused', trending: false },
  { source: 'Google PAA', question: 'Do hair growth supplements actually work?', votes: null, emotion: 'confused', trending: false },
  { source: 'r/Nutrafol', question: 'Nutrafol worked for 3 months then plateaued — anyone else experience this?', votes: 356, emotion: 'worried', trending: false },
  { source: 'r/FemaleHairLoss', question: 'Finally found something that works after 3 failed supplements — don\'t give up', votes: 678, emotion: 'hopeful', trending: false },
  { source: 'r/HairLoss', question: 'Is topical better than oral for hair growth? Tired of swallowing pills', votes: 412, emotion: 'seeking', trending: false },
  { source: 'Google PAA', question: 'Nutrafol vs Viviscal vs biotin — which actually helps?', votes: null, emotion: 'seeking', trending: false },
];

const resultsBySegment: Record<string, ResearchResult[]> = {
  glp1: glp1Results,
  postpartum: postpartumResults,
  perimeno: perimenoResults,
  pillfatigue: pillfatigueResults,
};

export function getMockResearchResults(segmentId: string): ResearchResult[] {
  return resultsBySegment[segmentId] ?? [];
}
