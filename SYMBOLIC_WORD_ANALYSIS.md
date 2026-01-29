# Biblical Symbolic Word Analysis Algorithm

A systematic process for discovering the symbolic meaning of words in Scripture.

## Overview

This algorithm helps decode what abstract concepts (light, salt, water, fire, leaven, etc.) symbolically represent in Scripture by analyzing how the Bible itself defines, uses, and applies these terms.

---

## SOURCE TEXT

**Primary Source**: KJV (King James Version) Bible with Strong's Concordance references
- Location: `http/kjv_strongs.txt`
- This allows tracing original Hebrew/Greek words when needed

---

## CRITICAL: THE EXECUTABLE WORKFLOW

**Warning**: This is not a document to "keep in mind." It is a **step-by-step process to execute**. Skipping steps leads to wrong conclusions. "Mental math" — keeping things in your head instead of showing work — causes failure.

> "Lean not on your own understanding" applies to the analysis process itself.

### Phase 1: Generate Multiple Candidates (NEVER STOP AT ONE)

You MUST generate at least 3 candidate meanings before evaluating. Assume your first conclusion is wrong.

| Step | Action | Checkpoint |
|------|--------|------------|
| 1.1 | Generate **Candidate #1** (first intuition) | Write it down explicitly |
| 1.2 | **REJECT CHECK**: Is this a dictionary definition or synonym? | If YES → discard, generate another |
| 1.3 | **Assume Candidate #1 is WRONG** → Generate **Candidate #2** | Must be meaningfully different |
| 1.4 | **REJECT CHECK**: Is this a dictionary definition or synonym? | If YES → discard, generate another |
| 1.5 | **Assume Candidate #2 is WRONG** → Generate **Candidate #3** | Must be meaningfully different |
| 1.6 | **REJECT CHECK**: Is this a dictionary definition or synonym? | If YES → discard, generate another |

**Rejection Examples:**

| Symbol | Dictionary/Synonym (REJECT) | Symbolic (CONSIDER) |
|--------|----------------------------|---------------------|
| WATER | Liquid, H2O, fluid | People/Masses |
| LIGHT | Brightness, illumination | Example |
| TREE | Plant, wood, timber | Nation |
| FIRE | Heat, flame, burning | Judgment |
| OIL | Grease, lubricant, fat | Proven Works |

> **Test**: Would a secular reader using only a dictionary arrive at this meaning? If YES → it's not the symbolic meaning.

---

### Phase 2: Test Each Candidate Systematically

For **EACH** candidate, execute this checklist. **Show your work** — write out each step explicitly.

| Step | Action | Write Out |
|------|--------|-----------|
| 2.1 | **LOOK UP** all related symbols from the Symbol Dictionary | List each symbol with IS/IS2/DOES/DOES2 |
| 2.2 | **IDENTIFY** all other known symbols in Context A | List them with their meanings |
| 2.3 | **SUBSTITUTE ALL** known symbols + candidate into Context A | Write the FULLY substituted sentence |
| 2.4 | **IDENTIFY** all other known symbols in Context B | List them with their meanings |
| 2.5 | **SUBSTITUTE ALL** known symbols + candidate into Context B | Write the FULLY substituted sentence |
| 2.6 | **IDENTIFY** all other known symbols in Context C | List them with their meanings |
| 2.7 | **SUBSTITUTE ALL** known symbols + candidate into Context C | Write the FULLY substituted sentence |
| 2.8 | **CHECK**: Does the FULLY substituted sentence make coherent sense? | If not, candidate fails |
| 2.9 | **CHECK**: Does it contradict Torah? | Explain why/why not |
| 2.10 | **CHECK**: Does it create redundancy with another law? | Explain why/why not |
| 2.11 | **CHECK**: Does it fit the production chain? (for physical symbols) | Trace the chain explicitly |
| 2.12 | **CHECK**: Can it be bought/sold if Scripture says so? | Verify consistency |
| 2.13 | **CHECK**: Does burning/consuming it produce expected result? | Verify consistency with related symbols |

**CRITICAL**: At step 2.1, you MUST actually look up the symbols. Do NOT rely on memory. Memory fails. The documented definition is the source of truth.

**CRITICAL**: When substituting, you must substitute ALL known symbols in the verse, not just the candidate. The new symbol must fit coherently with the entire symbolic sentence.

**Example (Testing OIL = Proven Works):**

| Step | Action |
|------|--------|
| Original verse | "Burning **oil** produces **light**" |
| Identify known symbols | LIGHT = Example (IS), Visible Example (IS2) |
| Substitute ALL | "Burning **[Proven Works]** produces **[Visible Example]**" |
| Coherence check | ✓ Makes sense: expending proven works produces a visible example for others |

---

### Phase 3: Compare Candidates in a Table

Create an explicit comparison table. Do not evaluate "in your head."

| Criterion | Candidate #1: _____ | Candidate #2: _____ | Candidate #3: _____ |
|-----------|---------------------|---------------------|---------------------|
| Fits Context A | ✓ / ✗ + reason | ✓ / ✗ + reason | ✓ / ✗ + reason |
| Fits Context B | ✓ / ✗ + reason | ✓ / ✗ + reason | ✓ / ✗ + reason |
| Fits Context C | ✓ / ✗ + reason | ✓ / ✗ + reason | ✓ / ✗ + reason |
| No Torah violation | ✓ / ✗ + reason | ✓ / ✗ + reason | ✓ / ✗ + reason |
| No legal redundancy | ✓ / ✗ + reason | ✓ / ✗ + reason | ✓ / ✗ + reason |
| Production chain fits | ✓ / ✗ + reason | ✓ / ✗ + reason | ✓ / ✗ + reason |
| Coherent with existing symbols | ✓ / ✗ + reason | ✓ / ✗ + reason | ✓ / ✗ + reason |
| **TOTAL SCORE** | ___ / 7 | ___ / 7 | ___ / 7 |

---

### Phase 4: Select Best Fit with Documented Reasoning

1. **Winner**: State which candidate scored highest
2. **Reasoning**: Explain why this candidate is superior
3. **Weaknesses**: Note any remaining concerns
4. **Confidence Level**: High / Medium / Low

---

### Why This Process Matters

| Failure Mode | What Happens | This Process Prevents It By |
|--------------|--------------|----------------------------|
| First intuition bias | Accept wrong meaning because it "feels right" | Forcing 3 candidates minimum |
| Dictionary trap | Propose synonym, not symbolic meaning | Explicit rejection filter |
| Memory error | Use wrong definition for related symbol | Mandatory lookup step |
| Mental math | Skip verification, miss contradictions | Written substitution requirement |
| Confirmation bias | Only test contexts that support guess | Structured comparison table |

> **The process IS the protection.** Skipping steps reintroduces the failure modes.

---

## THE ALGORITHM

### Step 0: Early Focus Checklist (RUN FIRST)

Before deep analysis, quickly answer these questions to focus your approach:

| # | Question | Why It Helps |
|---|----------|--------------|
| 1 | **What TYPE is this symbol?** (Event, Character, Action, Standard, Structure, Relationship) | Determines which analysis approach to prioritize |
| 2 | **Is there an EXPLICIT definition?** ("X IS Y" in Scripture) | Fastest path — Scripture may directly define it |
| 3 | **Does this symbol appear in a PARABLE?** | Parables often provide explicit definitions |
| 4 | **What is COMPARED TO this symbol?** ("X is like a [symbol]") | Find what Scripture explicitly likens to this symbol |
| 5 | **What is the OPPOSITE?** Is its meaning already known? | Antithesis often reveals meaning quickly |
| 6 | **What is its POSITION relative to other symbols?** | Relational symbols derive meaning from position |
| 7 | **What VERBS accompany it?** | Event-symbols are revealed by accompanying actions |
| 8 | **Is it defined IN TERMS OF another symbol?** | Trace recursive chains to foundational meanings |
| 9 | **Am I proposing a LITERAL SYNONYM?** | If so, dig deeper — you haven't found the symbolic meaning |
| 10 | **What does it DO?** (Not just what it IS) | The functional dimension often reveals deeper meaning |
| 11 | **What SYMBOLS is it PAIRED WITH?** | Symbol pairings reveal dynamics and relationships |
| 12 | **What is the Strong's number?** Has the same word been translated differently elsewhere? | Translation variations may obscure patterns |
| 13 | **Are there PARADOXES?** Do any verses seem to contradict each other about this word? | Paradox resolution reveals deeper meaning |
| 14 | **Does saying the word accomplish what Scripture promises?** | If not, the meaning is deeper than the word |
| 15 | **Is this an INVOCATION symbol?** (calling on, acting in, believing on) | Ask what RELATIONSHIP is being invoked |
| 16 | **Is there a CONCENTRATED PASSAGE?** (word appears many times in one chapter) | Dense clusters reveal core meaning |
| 17 | **Does the NT QUOTE the OT using this word?** | Trace back to original context |
| 18 | **Does this word seem OUT OF PLACE or random in its context?** | Incongruity signals intentional symbolic meaning |
| 19 | **Would proposed meaning create LEGAL REDUNDANCY with another law?** | If another law already handles it (e.g., death penalty), meaning must be different |
| 20 | **HOW IS THIS THING MADE/PRODUCED?** What is it made FROM? | Trace the production chain to existing symbols |

#### Category Types:

| Category | Examples | Primary Analysis |
|----------|----------|------------------|
| **EVENTS** | Moment (judgment), Sleep (death) | Look at accompanying VERBS |
| **CHARACTERS** | Virgin (faithful), Harlot (idolater) | Look at OPPOSITE character |
| **ACTIONS/POSTURES** | Faith (obedience), Fornication (idolatry) | Look at behavioral commands |
| **STANDARDS** | Truth (God's standard) | Look at recursive definitions |
| **STRUCTURES** | Mountain (kingdom), Rock (covenant) | Follow symbolic chain deeper |
| **RELATIONSHIPS** | Island (set-apart from sea) | Analyze position relative to other symbols |

> **Principle**: Identifying the category early focuses your analysis on the most productive approach.

---

### Step 1: Data Gathering

Search the KJV Bible for all verses containing the target word. Collect 100-150 representative verses, prioritizing:

- **Definitional verses**: Where the word is explicitly defined ("X IS Y")
- **Parallel verses**: Where the word is paired with other concepts ("X AND Y")
- **Antithetical verses**: Where the word is contrasted with its opposite
- **Behavioral commands**: Instructions involving the word (walk in X, be children of X, follow X, do X)
- **Functional verses**: What the word DOES (verbs/actions associated with it)
- **Christological verses**: Christ's relationship to the word (Does He claim to BE it? Embody it?)

---

### Step 2: Categorize Verses

Sort collected verses into these categories:

| Category | Pattern | What to Look For |
|----------|---------|------------------|
| **Definitional** | "X IS Y" | Explicit equations |
| **Parallel** | "X AND Y" | Concepts joined together (near-synonyms) |
| **Antithetical** | "X vs. NOT-X" | Explicit opposites |
| **Behavioral** | Commands about X | Walk in X, be children of X, follow X, do X |
| **Functional** | What X DOES | Verbs/actions associated with the word |
| **Christological** | Christ's relationship to X | Does He claim to BE it? Embody it? |

---

### Step 2B: Identify Recursive Definitions (CRITICAL)

Before proceeding with deeper analysis, check if your target word is **defined in terms of OTHER biblical symbols**.

#### Look for equations like:
- "[TARGET] IS [OTHER SYMBOL]" — e.g., "thy WORD is TRUTH"
- "[OTHER SYMBOL] IS [TARGET]" — e.g., "thy LAW is the TRUTH"
- Christ claims to BE both [TARGET] and [OTHER SYMBOL]

#### Why this matters:
Some symbols are **recursively defined** in terms of other symbols. This creates a web of interconnected meanings where understanding one symbol requires understanding another.

#### Example: TRUTH
| Equation | Reference |
|----------|-----------|
| Thy **WORD** is **TRUTH** | John 17:17 |
| Thy **LAW** is the **TRUTH** | Psalm 119:142 |
| I am the way, the **TRUTH**, and the life | John 14:6 |
| **TRUTH** shall make you **FREE** | John 8:32 |
| The **SON** shall make you **FREE** | John 8:36 |

This reveals: TRUTH → WORD → LAW → God's Standard/Commandments

#### Action Steps:
1. List all "X is [TARGET]" and "[TARGET] is Y" equations found in Scripture
2. Map the recursive chain back to foundational concepts
3. Check if your target symbol **points to** an already-resolved symbol
4. Check if behavioral phrases work: Can you "DO" [TARGET]? "WALK in" [TARGET]?
5. If a phrase like "do [TARGET]" exists, ask: "How do you DO [OTHER SYMBOL]?" — does it make sense?

> **Principle**: Some symbols are "pointers" to other symbols. The symbolic meaning may be inherited from or shared with the referent. Resolving the foundational symbol first may clarify dependent symbols.

---

### Step 2C: Analyze Symbolic Relationships

When a symbol exists in spatial or conceptual relationship to another symbol, the **relationship itself** may reveal the meaning.

#### Ask These Questions:
1. What is this symbol's relationship to other symbols? (above, within, surrounded by, separated from, etc.)
2. Does this relationship point to a known biblical concept?
3. What **verb/action** is implicit in the relationship?

#### Common Relationship Patterns:

| Physical Relationship | Ask | May Point To |
|----------------------|-----|--------------|
| X is **set apart from** Y | What does "set apart" mean biblically? | Sanctification/Holiness |
| X is **above** Y | What does elevation represent? | Authority/Rulership |
| X is **within** Y | What does containment represent? | Indwelling/Possession |
| X **comes out of** Y | What does emergence represent? | Birth/Origin |
| X **surrounds** Y | What does encirclement represent? | Protection/Siege |

#### Example: ISLAND and SEA
- SEA = Peoples, multitudes, nations (Rev 17:15)
- ISLAND = Land **SET APART FROM** the sea
- "Set apart" = SANCTIFIED/HOLY
- Therefore: ISLAND = Sanctified/Set-Apart People

> **Principle**: The symbolic meaning may be in the RELATIONSHIP, not the object itself. Look for the verb/action implicit in how symbols relate to each other.

---

### Step 3: Functional Analysis (CRITICAL)

#### 3A: What does [WORD] DO? (Internal function)
List all verbs/actions associated with the word:
- What actions does it perform?
- What effects does it cause?

#### 3B: What does [WORD] DO TO/FOR OTHERS? (Relational function)
This is crucial—ask:
- Does it demonstrate/model something?
- Does it lead/guide others?
- Does it teach/show by example?
- How does it affect the behavior of those who encounter it?

> **Key Insight**: The RELATIONAL function often reveals the symbolic meaning more clearly than the internal function.

---

### Step 4: Behavioral Command Analysis

#### 4A: How does Scripture tell us to RELATE to [WORD]?
- What posture do we take toward it?
- What actions are we commanded regarding it?

#### 4B: Human Application Stress Test (DO THIS EARLY)

Immediately ask:
- **"Can humans BE this thing?"**
- **"Does this fit human nature and calling?"**

If it works for God but NOT humans, you may have found the SOURCE meaning, not the INSTRUMENT meaning.

If it works for BOTH God AND humans, you likely have the correct symbolic meaning.

> **Example**: "Ye are the [WORD] of the world" — Does this make sense?

---

### Step 5: Antithetical Analysis

- What is the explicit OPPOSITE of [WORD] in Scripture?
- What does that opposite represent?
- Does your proposed meaning's opposite align?

> **Principle**: A word's opposite often clarifies its meaning. If DARKNESS represents hidden evil/confusion, then LIGHT represents visible righteousness/clarity.

---

### Step 6: Christological Confirmation

- Does Jesus claim to BE [WORD]?
- Does He embody this in His life/teaching?
- Is this something He calls US to be as well?

> **Pattern to look for**: Christ IS [X] → Believers ARE [X] (same designation, derived source)

---

### Step 7: Substitution Stress Test

Test your proposed symbolic meaning by substituting it in key verses:

| Verse Type | Test Question |
|------------|---------------|
| God/Christ as subject | Does it fit divine nature? |
| Humans as subject | Does it fit human nature/calling? |
| Behavioral commands | Does it produce coherent instructions? |
| Difficult/unusual verses | Does it still make sense? |

Create a table testing your proposed meaning across 8-10 key verses, including both God-subject and human-subject verses.

---

### Step 8: Unification Test

#### 8A: Does your meaning unify other partial meanings?
A good symbolic meaning is often a META-CONCEPT that explains HOW the word functions across contexts.

#### 8B: Does it work for BOTH Source AND Instrument?
The best symbolic meaning applies to:
- God/Christ (the source/origin)
- Believers (the instruments/vessels)

If it only works for one, you may have found a partial meaning.

---

## OUTPUT FORMAT

### Save Your Work
After completing analysis, save the full argumentation to `symbols/[WORD].md` with:
- The one-word, two-word, and sentence meanings
- The logical argument with numbered evidence sections
- Key proof texts with explanation
- The substitution test table

Update `SYMBOL_DICTIONARY.md` with a summary entry linking to the full study.

### Provide:

1. **Top 3 symbolic meanings** ranked by strength
2. **Human application test** for each ("Ye are the [WORD] of the world" — does it work?)
3. **Key proof texts** for each meaning
4. **The opposite** of each meaning
5. **Substitution test table** showing the meaning applied to 8-10 key verses (include both God-subject and human-subject verses)
6. **Meta-meaning identification**: If one meaning unifies the others AND works for both God and humans, identify it as the meta-meaning
7. **1-2 word summary** that captures the symbolic meaning

---

## FOUNDATIONAL ASSUMPTIONS

### Scripture is Intentionally Designed

Assume Scripture has **intentional design** to preserve meaning across:
- **Time** — resists "language rot" as word meanings drift
- **Translation** — symbolic relationships survive into any language (given consistent, literal translation)
- **Scattering** — truth is distributed: "here a little, there a little, precept upon precept" (Isaiah 28:10,13)

> **Principle**: The symbolic system is robust by design. If your interpretation depends on a quirk of one translation or one verse, it's likely wrong. True patterns appear consistently across Scripture.

### Watch for Translation Variations

A single Hebrew/Greek word may be translated **multiple different English words**, obscuring the underlying pattern.

**Example**: The Hebrew word שָׁלוֹם (H7965 - *shalom*) is translated as:
- "peace" (most common)
- "prosperity"
- "welfare"
- "safe"
- "health"

If you only search for "peace," you miss verses where the SAME concept appears under a different English word.

**Solution**: Use Strong's numbers to find ALL occurrences of the original word, regardless of English translation.

```
# Search by Strong's number, not English word:
H7965 → finds ALL "shalom" verses
```

> **Principle**: When analyzing a symbol, always check the Strong's number to find ALL instances of the original word — the translator's choice of English word may have obscured patterns.

---

## PROBLEM-DRIVEN ANALYSIS (CRITICAL)

The most powerful breakthroughs come from **reasoning from problems**, not just cataloguing patterns.

### Start with Paradoxes and Tensions

Look for verses that seem to **contradict** each other or create **tension** with the surface meaning. The resolution of the paradox often reveals the deeper symbolic meaning.

#### The Abraham Paradox (Example: NAME)

| Observation | Verse | Tension |
|-------------|-------|---------|
| The NAME was **not known** to Abraham | Exodus 6:3 — "by my name YHWH I was not known to them" | |
| Yet Abraham clearly **spoke** the word YHWH | Genesis 15:7 — "I am YHWH who brought you out" | **Contradiction!** |
| | Genesis 18:14 — "Is anything too hard for YHWH?" | |

**Resolution**: If Abraham spoke the word YHWH but didn't "know the NAME," then **NAME ≠ the word/pronunciation**. The NAME must be something DEEPER than the spoken word.

This single paradox eliminates literal interpretations and forces us to ask: "What IS the name if not the word?"

#### The "Lord, Lord" Paradox (Example: NAME)

| Observation | Verse | Tension |
|-------------|-------|---------|
| People said **"Lord, Lord"** | Matthew 7:22 | They invoked the NAME |
| They did **miracles "in thy name"** | "in thy name cast out devils... done many wonderful works" | The word had POWER |
| Yet they were **rejected** | Matthew 7:23 — "I never knew you: depart from me, ye workers of **LAWLESSNESS**" | **Contradiction!** |

**Resolution**: If saying the word accomplished miracles but didn't save them (because they were "workers of lawlessness"), then the NAME must be connected to **OBEDIENCE/LAW/COVENANT** — not just the spoken word.

#### Action Steps:
1. When analyzing a symbol, **search for apparent contradictions** involving that word
2. Ask: "If both verses are true, what must this word REALLY mean?"
3. The meaning that **resolves the paradox** is likely the correct symbolic meaning
4. Paradoxes eliminate wrong interpretations and force deeper analysis

> **Principle**: When the literal/surface meaning creates a problem or contradiction, that's the signal to dig deeper — the resolution of the paradox IS the symbolic meaning.

---

### The "Magic Word" Test

If merely **saying the word** doesn't accomplish what Scripture promises, the meaning must be **deeper than the word itself**.

**Example (NAME)**:
- Jesus promised: "Whatever you ask in my NAME, I will do it" (John 14:13-14)
- Yet prayers ending "in Jesus' name" often go unanswered
- Therefore: "in my NAME" ≠ speaking magic words
- It must mean something about the RELATIONSHIP/COVENANT being invoked

**Example (FAITH)**:
- Scripture promises mountains move with faith
- Yet people claim to "have faith" and nothing happens
- Therefore: FAITH ≠ mental belief/feeling
- It must mean something about OBEDIENT ACTION

> **Principle**: If invoking the word doesn't produce the promised result, the symbolic meaning is deeper than the word. Ask: "What relationship, commitment, or action is actually being invoked?"

---

### The Relationship Test (For Invocation Symbols)

When a symbol involves **invoking**, **calling upon**, **acting in**, or **being identified by** something, ask:

> **"What RELATIONSHIP is being invoked or appealed to?"**

| Phrase | Surface Reading | Relationship Question | Answer |
|--------|-----------------|----------------------|--------|
| "In the NAME of the king" | Speaking the king's name | What grants this authority? | COVENANT (subject to king) |
| "Believe on his NAME" | Mental assent to a word | What relationship is being trusted? | COVENANT (His promises) |
| "For his NAME's sake" | For the sake of a word | What obligation causes this action? | COVENANT (His commitment) |
| "Baptized in the NAME" | Ritual with spoken words | What relationship is being entered? | COVENANT (identification with) |

> **Principle**: Invocation symbols point to RELATIONSHIPS, not words. The symbolic meaning is usually the RELATIONSHIP being invoked.

---

### Find Explicit Equations (Parallel Substitution)

Search for verses where the symbol is **equated with** or **parallel to** another concept. Scripture sometimes directly substitutes one term for another.

**Example (NAME = ARK/COVENANT)**:

| Verse | Text | Equation |
|-------|------|----------|
| 2 Samuel 7:2 | David: "the **ark of God** dwells in a tent" | David wants to build a house for THE ARK |
| 2 Samuel 7:13 | God: "He shall build a house for **My NAME**" | God says the house is for THE NAME |

**Conclusion**: NAME = ARK (of the Covenant) = THE COVENANT ITSELF

This is an **explicit substitution** where God replaces "ark" with "name" — revealing they represent the same thing.

#### Action Steps:
1. Find verses where someone talks ABOUT the symbol using one term
2. Find parallel verses where God (or the text) uses a DIFFERENT term for the same thing
3. The substituted term reveals what the symbol represents

---

### Analyze Concentrated Passages (Density Analysis)

Find passages where the target word appears **many times** in covenant/definitional context. These "dense clusters" are rich for analysis.

**Example (NAME in Solomon's Prayer — 1 Kings 8)**:
- "The NAME" appears **16 times** in this chapter
- Every occurrence is in COVENANT context:
  - Forgiveness of sins
  - Turning/repentance
  - Confessing the name
  - Foreigners coming "for thy name's sake"
- Pattern: THE NAME = THE COVENANT (invoked for forgiveness, relationship, restoration)

> **Principle**: Passages with heavy concentration of a word often reveal its deepest meaning. The context of the dense cluster IS the meaning.

---

### Follow Cross-References to Source

When a New Testament verse **quotes** the Old Testament, trace the quotation back to its **original context**. The full OT context often reveals the complete meaning.

**Example (Romans 10:13 → Deuteronomy 30)**:

| NT Verse | OT Source | What It Reveals |
|----------|-----------|-----------------|
| Romans 10:13 — "whosoever shall call upon the NAME of the Lord shall be saved" | Joel 2:32 | Surface: call = speak words |
| Romans 10:6-8 — Paul explains using Deut 30:11-14 | Deuteronomy 30:11-14 | Deeper context |
| Deut 30:14 — "the word is very near you... **so that you can DO IT**" | | "Calling on the name" = DOING the word = OBEDIENCE |

Paul's quotation chain reveals: "Call on the NAME" = Obey the WORD = Keep the COVENANT

> **Principle**: When NT quotes OT, trace it back. The original context often completes the meaning that the NT assumes readers understand.

---

### Trace the Symbol's Origin (Production Chain Analysis)

Ask: **"How is this thing physically made/produced? What is it made FROM?"**

Then connect each step in the production chain to known symbols.

#### Example: OIL

**Production Chain:**
1. **OLIVE TREES** produce **OLIVES** (fruit)
2. Olives are **PRESSED/CRUSHED**
3. **OIL** is extracted

**Symbolic Chain:**
- OLIVE TREE → TREE = Nation/Covenant Community (Israel per Romans 11)
- OLIVES → FRUIT = Works
- PRESSING → Trials/Testing
- OIL → **Works that have been tested/proven**

This method exposed why mainstream "OIL = Spirit" is wrong:
- The Spirit is a **gift** that cannot be bought (Acts 8:20)
- But Matthew 25:9 says "go **buy**" oil
- Therefore OIL ≠ Spirit

By tracing the production chain, we arrive at: **OIL = Proven Works**

#### Action Step:

For physical symbols (oil, wine, bread, water, etc.), always ask:
1. What is the raw material?
2. What process transforms it?
3. What do those steps symbolize?

---

### The Redundancy Test (Would This Meaning Create Legal Redundancy?)

If a proposed symbolic meaning would create **legal or logical redundancy** with an existing law or principle, the meaning must be wrong.

#### Example: Fornication in Divorce Passages

**Problem**: Jesus says divorce is permitted "except for fornication" (Matthew 5:32, 19:9). Many assume this means "sexual adultery."

**Redundancy Check**: Under Torah, sexual adultery carries the **death penalty** (Leviticus 20:10, Deuteronomy 22:22).

**The Logic**:
- If adultery = death, you don't NEED a divorce provision for it
- The marriage ends by execution, not paperwork
- Therefore "fornication" must mean something WITHOUT a death penalty

**Conclusion**: Fornication = **idolatry** (not sexual sin). This resolves the redundancy.

#### Action Step:

Ask: "If this word meant [proposed meaning], would it duplicate or conflict with another biblical law?" If yes, the meaning is likely wrong.

---

### The Incongruity Test (Why Is This Here?)

When a word or phrase seems **out of place**, **random**, or **unnecessary** in its context, ask:

> **"Why is this mentioned HERE? What does it add?"**

Apparent randomness is often a signal of **intentional symbolic design**. The author included it for a reason — the incongruity is pointing you to look deeper.

#### Examples:

**1. Numbers that seem arbitrary**:
> **John 21:11** — "Simon Peter... drew the net to land full of great fishes, **an hundred and fifty and three**"

Why specify 153? It seems random. But the specificity signals intentional meaning — scholars have proposed various symbolic interpretations (gematria, triangular numbers, species of fish = nations, etc.). The incongruity invites investigation.

**2. Details that seem unnecessary**:
> **Mark 14:51-52** — "And there followed him a certain young man, having a **linen cloth** cast about his naked body... And he left the **linen cloth**, and fled from them **naked**."

Why include this strange detail about a random young man? The incongruity signals symbolic meaning — nakedness (exposure/shame), linen (priestly garment), fleeing (abandoning commitment).

**3. Words that break the flow**:

When a narrative suddenly inserts a word that doesn't seem to fit the immediate context, ask what that word's SYMBOLIC meaning would contribute.

#### Action Steps:
1. When reading, notice moments of "wait, why is that here?"
2. Don't dismiss apparent randomness — it's often intentional
3. Ask: "What would this ADD if it has symbolic meaning?"
4. Look up the word in your symbol dictionary — does its meaning illuminate the passage?
5. If no known symbol, this may be a new symbol to analyze

> **Principle**: Scripture is intentionally designed. Nothing is truly "random." Incongruity is an invitation to discover symbolic meaning. The question "Why is this here?" often leads to breakthrough insights.

---

## KEY PRINCIPLES

### Focus on Relational Function
The best symbolic meaning describes what the word DOES RELATIONALLY—not just what it equals or reveals, but how it demonstrates, models, leads, and affects others.

### The Dual-Application Test
The best symbolic meaning will describe a way of life that:
- God embodies perfectly (SOURCE)
- Humans are called to follow (INSTRUMENT)

### Let Scripture Interpret Scripture
Prioritize how the Bible ITSELF defines and uses the word over external sources or assumptions.

### Symbolic Meanings Differ from Dictionary Meanings
The symbolic meaning of a word in Scripture is usually **different from its literal/dictionary definition**. "Light" doesn't symbolize "electromagnetic radiation"—it symbolizes "visible example." Always look for the FUNCTIONAL, RELATIONAL meaning rather than the physical description.

### Watch for Unified Meta-Meanings
Often a single concept underlies multiple partial meanings. Look for the concept that EXPLAINS why the word is used in diverse contexts.

### Identify Recursive/Pointer Symbols
Some symbols are defined in terms of other symbols (e.g., "thy WORD is TRUTH"). When you find recursive definitions:
- Map the chain: SYMBOL A → SYMBOL B → FOUNDATIONAL CONCEPT
- The "foundational" symbol often carries the core meaning
- Dependent symbols may inherit, share, or specialize that meaning
- Resolve foundational symbols first when possible

### Avoid Literal Synonyms
A common error is proposing a meaning that is merely a **physical synonym** of the word. "Foundation" for "rock" is not a symbolic meaning—it's just another word for the same physical concept. Always push past literal descriptions to functional, relational, or covenantal meanings.

### Use Parables as Symbol Keys (CRITICAL)

Parables are controlled contexts where **multiple symbols appear together** and Scripture often **explicitly interprets** them.

#### Why Parables Matter:
1. Parables often DEFINE symbols explicitly (e.g., "the seed IS the word")
2. Multiple symbols must work TOGETHER coherently
3. You can TEST your meanings: substitute all symbols and see if the parable makes sense

#### Example: Parable of the Sower (Matthew 13)
| Symbol | Explicit Definition |
|--------|---------------------|
| **SEED** | "The word" (Matt 13:19) |
| **GROUND/SOIL** | The heart (Luke 8:15 - "honest and good heart") |
| **THORNS** | "Care of this world, deceitfulness of riches" (Matt 13:22) |
| **FRUIT** | What results from receiving the word |

Since TREE = Nation/People, and THORNS are a type of plant/tree:
- **THORNS = A type of people** characterized by worldly cares, riches, pleasures
- They CHOKE others — prevent fruitfulness

#### Action Steps:
1. Find parables containing your target symbol
2. Note what other symbols appear alongside it
3. Look for explicit interpretations Jesus provides
4. Test: Do ALL your symbol meanings work together in the parable?
5. If one meaning breaks the parable, re-evaluate

> **Principle**: Parables provide a "test environment" for symbol meanings. All symbols must work together coherently when substituted.

---

### Look for Comparative Metaphors (CRITICAL)
Ask: **"What does Scripture explicitly COMPARE TO this symbol?"**

Don't just ask "what does [symbol] represent?" — ask "what is said to BE [symbol] or BE LIKE [symbol]?"

**Example (TREE)**:
- Initial thought: "Trees = People" (Mark 8:24 — "I see men as trees")
- Comparative search: What is compared TO a tree?
  - Isaiah 5:7 — "The **vineyard** of the LORD **IS the house of ISRAEL**"
  - Daniel 4:22 — The great tree = "It is THOU, O king" (Babylon as empire)
  - Ezekiel 31:3 — "The **Assyrian** was a **cedar**"
- Corrected meaning: TREE = **EMPIRE** (dominant political structure)

**Example (ANIMAL)**:
- Peter's vision (Acts 10:28) — Unclean animals = Gentile MEN ("God hath shewed me that I should not call any MAN common or unclean")
- Daniel 4:12,21 — Beasts dwell UNDER the tree (Babylon)
- Genesis 49 comparisons: **Judah** = lion, **Benjamin** = wolf (TRIBES)
- Meaning: ANIMAL = **TRIBE/SUB-STATE** (people-group characterized by nature)

> **Principle**: The collective pattern of COMPARATIVE METAPHORS reveals the true symbolic meaning. Look for "X IS a [symbol]" or "X IS LIKE a [symbol]" across Scripture.

### Resolve Symbolic Overlap via Positional Relationships

When two symbols seem to have **similar meanings**, find passages where they appear **TOGETHER** to discover their **hierarchical relationship**.

**Example (TREE + ANIMAL)**:
- Both seem to mean "nation/people"
- Daniel 4:12,21 shows them TOGETHER: "the **beasts** of the field had shadow **UNDER** it [the tree]"
- The **SPATIAL relationship** (under) reveals the **HIERARCHICAL relationship**:
  - TREE = Empire (dominant structure)
  - ANIMAL = Tribes/Sub-states (subordinate peoples under the empire)

| Spatial Position | Hierarchical Meaning |
|------------------|---------------------|
| **UNDER** | Subordinate |
| **OVER** | Dominant |
| **IN** | Contained within / Part of |
| **FROM** | Origin / Source |

> **Principle**: When two symbols seem synonymous, look for passages where they appear TOGETHER. Their spatial/positional relationship reveals their hierarchical distinction.

### Define Dependencies First
If your proposed symbolic meaning uses an abstract concept (like "faithfulness"), make sure that concept is **already symbolically defined**. If not, define it first. For example, before saying ROCK = "Faithful," you must first establish what FAITH/FAITHFULNESS symbolically means.

### Follow the Symbolic Chain Deeper
Don't stop at the first abstract concept. Keep asking **"What does THIS symbolize?"** until you reach a concrete biblical concept.

**Example (ROCK)**:
```
ROCK (physical)
  ↓ What characterizes a rock?
UNCHANGING (abstract — don't stop here!)
  ↓ What is unchanging between God and man?
COVENANT (concrete biblical concept — stop here)
```

The chain: ROCK → Unchanging → Everlasting → **COVENANT**

### Use the Existing Symbol Table
Filter all proposed meanings through already-established symbols. Each new symbol should **fit coherently** with the existing symbolic web:

| Symbol | Meaning | Check for Coherence |
|--------|---------|---------------------|
| TRUTH | God's Standard | Does new symbol relate? |
| FAITH | Obedience | Does new symbol relate? |
| LIGHT | Visible Example | Does new symbol relate? |
| etc. | etc. | etc. |

Ask: "How does [NEW SYMBOL] connect to the symbols we've already defined?"

### Identify the ACTIONS Associated with the Word
Ask: **What VERBS/ACTIONS consistently accompany this word?**

The symbolic meaning is often revealed by what HAPPENS in connection with the word, not just what the word describes.

**Example (MOMENT)**:
- What verbs accompany "moment"? → CONSUME, DESTROY, DIE, OVERTHROW
- These verbs point to: JUDGMENT/DESTRUCTION
- Therefore: MOMENT = Sudden Judgment

> **Principle**: Look at what ACTIONS/VERBS consistently accompany the word. The symbolic meaning may be an EVENT or ACTION, not just a descriptive quality.

### Follow the Dominant Pattern
Don't let a minority of uses pull you away from the majority pattern.

When 70% of uses point one direction and 30% point another:
- The 70% is the **primary meaning**
- The 30% may be an application, extension, or secondary use

**Example (MOMENT)**:
- Most uses = sudden destruction/judgment (dominant)
- Some uses = "brief period" contrast with eternal (secondary)
- The "brief period" uses are APPLICATIONS of the judgment idea

> **Principle**: Identify the dominant pattern first. Secondary patterns often derive from or apply the primary meaning.

### Words Import Their Shared Context
When a word appears in a verse, it **imports the subject matter** from all its other uses.

**Example (MOMENT)**:
- "Moment" appears in contexts of: judgment, destruction, sudden divine action
- When you see "moment" in ANY verse, this context is being imported
- The reader familiar with Scripture hears "sudden judgment" overtones

> **Principle**: Words function as "triggers" that import their associated subject matter. Ask: "What context does this word bring with it?"

### Test for Literal Synonyms (CRITICAL CHECK)
Before finalizing a meaning, ask: **"Is my proposed meaning just a dictionary synonym?"**

| Proposed Meaning | Test |
|------------------|------|
| MOMENT = "Temporary" | ❌ This is just what "moment" literally means |
| MOMENT = "Sudden Judgment" | ✓ This is the SYMBOLIC import—what the word brings with it |

If your answer is close to the dictionary definition, **you haven't found the symbolic meaning yet**. Keep digging.

### TWO DIMENSIONS: "IS" vs "DOES"

Every symbol has **two dimensions** of meaning:

| Dimension | Question | What It Reveals |
|-----------|----------|-----------------|
| **IS** | What IS it? (Ontological) | The nature/category/identity |
| **DOES** | What does it DO? (Functional) | The action/effect/consequence |

**Example (WICKEDNESS)**:
- **IS**: Lawlessness — transgressing God's covenant
- **DOES**: Burns/Devours — self-destructive, consuming even its own fruit

**Example (THORNS)**:
- **IS**: Cursed Fruit — the result of judgment/wickedness
- **DOES**: Chokes — prevents fruitfulness, afflicts the faithful

> **Principle**: Don't stop at "what it IS" — always ask "what does it DO?" The functional dimension often reveals the deeper symbolic import.

### Symbol Pairing Analysis

When two or more symbols appear TOGETHER in a verse, the **pairing itself** conveys additional meaning beyond the individual symbols.

#### Questions to Ask:
1. What is the **relationship** between Symbol A and Symbol B?
2. Is one the CAUSE and the other the EFFECT?
3. Is one the AGENT and the other the OBJECT?
4. Do they form a CONTRAST or COMPLEMENT?

#### Common Pairing Patterns:

| Pairing Type | Pattern | Example |
|--------------|---------|---------|
| **Cause → Effect** | A produces B | WICKEDNESS produces THORNS (Isa 5:6-7) |
| **Agent → Object** | A acts on B | WICKEDNESS devours THORNS (Isa 9:18) |
| **Opposition** | A vs. B | LIGHT vs. DARKNESS |
| **Parallel** | A and B together | BRIERS AND THORNS (same category, emphasis) |
| **Cycle** | A → B → A | Wickedness → Thorns → Devoured (self-destruction) |

#### Example: WICKEDNESS + THORNS (Isaiah 9:18)
> "For **wickedness** burneth as the fire: it shall **devour** the briers and thorns"

| Symbol | IS | DOES |
|--------|-----|------|
| WICKEDNESS | Lawlessness | Burns/Consumes |
| THORNS | Cursed Fruit | Chokes/Gets consumed |

**The Pairing Reveals**: 
- Wickedness (lawlessness) is the FIRE/CAUSE
- Thorns (cursed fruit) are the FUEL/RESULT
- Wickedness produces thorns, then devours its own fruit
- **Self-destructive cycle of rebellion**

> **Principle**: Symbol pairings reveal DYNAMICS — how symbols interact, what cycles they create, and what processes they represent. When you see paired symbols, map the relationship.

---

## EXAMPLE APPLICATION

**Word**: LIGHT

**Meta-Meaning**: VISIBLE EXAMPLE

**Summary**: Light symbolizes living in such a way that others can SEE and FOLLOW—being an example that demonstrates the right way.

**Verification**:
- "God is [visible example]" ✓
- "Ye are the [visible example] of the world" ✓
- "Let your [example] shine before men" ✓
- "Walk as children of [example]" ✓
- "I am the [visible example] of the world" ✓

**Opposite**: Hidden wickedness / concealed living / no witness

---

## WORDS TO ANALYZE

Use this algorithm to decode:

- [ ] Salt
- [ ] Water
- [ ] Fire
- [ ] Leaven
- [ ] Bread
- [ ] Wine
- [ ] Blood
- [ ] Rock/Stone
- [ ] Shepherd
- [ ] Vine/Branch
- [ ] Seed
- [ ] Fruit
- [ ] Door/Gate
- [ ] Way/Path
- [ ] (Add more as needed)

---

*This algorithm was developed through collaborative analysis and refined through application to biblical terms.*
