# NotebookLM Setup Guide — Folly Content Engine

**For:** Benoit
**Purpose:** How to set up and maintain the 4 NotebookLM notebooks that feed the Content Engine
**When:** At the start of each monthly Run, or when you want deeper research than the in-app Google search provides

---

## When to use NotebookLM vs In-App Research

**Use the in-app research (Path A)** when:
- You need to move fast (5 min per segment)
- You just need fresh Reddit questions and Google PAA results
- The segment's content pipeline is well-established (month 2+)

**Use NotebookLM (Path B)** when:
- It's the first Run for a segment and you need deep source grounding
- You want to cross-reference real questions against Folly's science docs
- You're not confident the in-app research is producing differentiated enough topics
- You want NotebookLM's Deep Research to pull in sources beyond what Google surfaces

---

## One-Time Setup (Do this once per segment)

### Step 1: Create 4 Notebooks

Create one notebook per segment in NotebookLM:
- `Folly — GLP-1 Shedding`
- `Folly — Postpartum`
- `Folly — Perimenopause / Hormonal`
- `Folly — Pill-Fatigue / Supplement Switchers`

### Step 2: Upload Permanent Sources (same for all 4 notebooks)

Upload these files to EVERY notebook. These are the science/brand foundation:

1. **Folly Messaging Playbook** (PDF or Google Doc)
2. **Microsphere Encapsulation Science One-Pager**
   - Key claims: 1,675mg total actives, dual-layer encapsulation, 98% B12 loss unencapsulated vs 0% encapsulated, 4-35x more actives than competitors
3. **Luna's Creative Positioning Document** (the 4 angles doc)
4. **Competitor Comparison Data** (Nutrafol, Viviscal, biotin standalone)
5. **Customer Research Synthesis** (4 segments + emotional micromoments)

### Step 3: Upload Segment-Specific Sources

**GLP-1 Notebook — add these:**
- Reddit threads from: r/Ozempic, r/semaglutide, r/tirzepatide, r/GLP1
  - Search for: "hair loss", "shedding", "thinning", "hair falling out"
  - Copy the thread URL and paste as a web source in NotebookLM
  - Aim for 15-20 threads with high engagement (100+ upvotes)
- Google "People Also Ask" results — screenshot or copy-paste the PAA boxes for:
  - "GLP-1 hair loss"
  - "semaglutide hair loss"
  - "Ozempic hair loss timeline"
  - "does tirzepatide cause hair loss"
  - "GLP-1 nutrient deficiency"

**Postpartum Notebook — add these:**
- Reddit: r/beyondthebump, r/postpartum, r/newparents, r/breastfeeding
  - Search for: "hair loss", "shedding", "postpartum hair", "when does it stop"
- Google PAA for: "postpartum hair loss", "breastfeeding hair loss", "when does postpartum shedding stop"

**Perimenopause Notebook — add these:**
- Reddit: r/menopause, r/perimenopause, r/PCOS, r/thyroid
  - Search for: "hair thinning", "hormone hair loss", "perimenopause hair"
- Google PAA for: "menopause hair thinning", "hormone hair loss", "thyroid hair loss", "PCOS hair loss"

**Pill-Fatigue Notebook — add these:**
- Reddit: r/Supplements, r/FemaleHairLoss, r/HairLoss
  - Search for: "Nutrafol", "hair supplement", "tired of pills", "does X work"
- Amazon reviews for Nutrafol (negative reviews, 1-3 stars) — screenshot and upload
- Google PAA for: "Nutrafol alternatives", "best hair supplements", "hair supplement side effects"

### Step 4: Set Custom Instructions

In each notebook, click "Configure Chat" and paste this custom instruction:

```
You are a research assistant for Folly Nutrition, a DTC hair health supplement brand.
Your job is to identify specific, emotionally resonant content topics for [SEGMENT NAME] 
customers based on the sources provided.

For each topic you identify:
1. Quote the exact language real people use when talking about this problem (from Reddit, reviews, etc.)
2. Identify the emotional state (frustrated, scared, hopeful, angry, confused, desperate, etc.)
3. Map the relevant Folly science claim that addresses this — cite the specific source
4. Suggest a blog headline that creates curiosity without giving away the answer
5. Suggest an email subject line that would make this person NEED to click
6. Rate the topic freshness: is this evergreen, trending, or seasonal?

CONSTRAINTS:
- Never suggest topics that require medical claims beyond "supports hair health"
- Never use "Clinically Proven" — only "Clinically Studied"  
- Never suggest content about hair regrowth — only hair health, strength, thickness
- Always ground claims in the actual Folly science documents provided
- Prioritize topics where the emotional intensity is HIGH (people are desperate, frustrated, scared)
  over topics that are merely informational
```

Replace `[SEGMENT NAME]` with the actual segment name for each notebook.

---

## Monthly Refresh (Do this at the start of each Run)

### Step 1: Add Fresh Sources (10-15 minutes per notebook)

For each notebook:
1. Search Reddit for new threads from the past 30 days in the relevant subs
2. Add 5-10 new high-engagement threads as web sources
3. Check Google PAA — has anything new appeared? Add if so.
4. If there are new competitor moves (Nutrafol blog post, new brand launch), add those

### Step 2: Run Topic Extraction (5 minutes per notebook)

Paste this prompt into each notebook's chat:

```
Based on all sources in this notebook, generate a table of 25 content topics for 
[SEGMENT] customers. For each topic, provide these columns:

1. headline — suggested blog headline
2. source_question — the exact question a real person asked (quote from source)
3. emotion — the emotional state (scared, frustrated, angry, desperate, confused, hopeful, etc.)
4. folly_hook — the specific Folly science claim that answers this (cite the source doc)
5. suggested_subject_line — email subject line (under 50 characters, curiosity-driven)
6. segment — [glp1 / postpartum / perimeno / pillfatigue]
7. freshness — trending / evergreen / seasonal

Prioritize:
1. Questions people are ACTUALLY asking (from Reddit, Google PAA) over assumed questions
2. High emotional intensity over informational curiosity  
3. Topics where Folly has a genuine, grounded answer
4. Variety — don't cluster around the same sub-topic
```

### Step 3: Export as CSV

1. NotebookLM will generate a data table. 
2. Click "Open in Sheets" or copy the table to Google Sheets.
3. Download as CSV.
4. Upload the CSV to the Content Engine app (Phase 2: Topic Import).

**CSV headers must match exactly:**
```
headline,source_question,emotion,folly_hook,suggested_subject_line,segment,freshness
```

See `topic-brief-template.csv` in the config folder for an example.

---

## Tips

- **Don't over-curate the sources.** Let NotebookLM see messy Reddit threads with real emotions. That rawness is what makes the content grounded.
- **Refresh Reddit sources monthly.** Stale sources = stale topics. People ask new questions every month.
- **Use Deep Research sparingly.** It's powerful but pulls in external sources that may not be relevant. For Folly, the uploaded sources (science docs + Reddit) are usually better grounding than what Deep Research finds on its own.
- **If NotebookLM suggests a topic that feels like a stretch**, check the "folly_hook" column. If the hook is vague or generic, the topic isn't grounded enough — skip it.
- **Keep a running list of topics you've already published** (the Content Engine tracks this in the Run history). Before importing, scan for near-duplicates. NotebookLM doesn't know what you published last month.

---

## Notebook Maintenance

- **Quarterly:** Review and remove outdated sources (old Reddit threads, competitor content that's been superseded)
- **Quarterly:** Re-upload updated versions of Folly's science docs if formulation or claims change
- **Monthly:** The customer research synthesis should be refreshed if new customer interviews are conducted
