# Scalable Structure for Numerical Argument Evaluation

## Proposed Structure: Hybrid with Numerical Scoring

### Core Principles:
1. **Keep existing fact structure** (proven, clear dependencies)
2. **Add numerical evidence scoring** (objective, comparable)
3. **Add explicit alternative comparison** (side-by-side evaluation)
4. **Create scalable metrics** (can be applied to any claim)

---

## STRUCTURE DESIGN

### Level 1: Fact Definition (Current Structure - Keep)
```
### H13. Herod's Death
- **Fact**: 1 BC
- **Evidence**: [list]
- **Dependencies**: [list]
- **Confidence**: Very High
```

### Level 2: Evidence Scoring (NEW - Add to each fact)
```
### H13. Herod's Death
- **Fact**: 1 BC
- **Evidence Score**: 87/100
  - **Primary Evidence** (4 lines, 60 points):
    - H5 (eclipse): 20 points (astronomical, precise, visible)
    - H11 (age): 15 points (direct calculation, explicit statement)
    - H12 (capture + reign): 15 points (explicit statement, precise)
    - H12g (regnal span): 10 points (cross-validation)
  - **Supporting Evidence** (1 line, 15 points):
    - H8b (Philip): 15 points (manuscript evidence, fits pattern)
  - **Penalty** (1 contradiction, -12 points):
    - H8a (Philip alternative): -12 points (requires special pleading)
  - **Bonus** (convergence, +12 points):
    - Multiple independent lines converge: +12 points
- **Dependencies**: H5, H11, H12, H12g, H8b
- **Confidence**: Very High (87/100)
```

### Level 3: Alternative Comparison (NEW - Separate section)
```
## COMPETING CLAIMS ANALYSIS

### Claim: Herod's Death Date

#### Claim A: 1 BC (Book's Position)
- **Evidence Score**: 87/100
- **Independent Lines**: 4 primary + 1 supporting = 5
- **Source Quality**: 
  - Astronomical: 1 (NASA catalog)
  - Historical: 2 (Josephus explicit statements)
  - Manuscript: 1 (older, unanimous)
  - Cross-validation: 1 (regnal span test)
- **Special Pleading Required**: None
- **Contradictions**: 1 (H8a, but explained)

#### Claim B: 4 BC (Traditional Position)
- **Evidence Score**: 42/100
- **Independent Lines**: 1 primary + 1 supporting = 2
- **Source Quality**:
  - Astronomical: 1 (partial eclipse, faint, 3 AM)
  - Manuscript: 1 (later, majority but not unanimous)
- **Special Pleading Required**: 
  - Zero-year ante-dating (unprecedented): -20 points
  - Dismissing "27 years to the day": -15 points
  - Ignoring age calculation: -10 points
  - Ignoring 107 high priests: -8 points
- **Contradictions**: 4 (H5, H11, H12, H12g all contradict)

#### Comparison Score: 87 vs 42 = 2.07:1 ratio (Book's claim 2x stronger)
```

---

## SCORING FRAMEWORK

### Evidence Strength Scoring (0-100 scale)

#### Primary Evidence (0-60 points)
- **Astronomical/Physical Evidence**: 15-25 points
  - Precise, measurable, verifiable
  - Example: Eclipse dates, astronomical alignments
- **Explicit Historical Statements**: 15-20 points
  - Direct quotes, unambiguous
  - Example: "27 years to the day"
- **Direct Calculations**: 10-15 points
  - Simple math from established facts
  - Example: Age calculations, regnal spans
- **Cross-Validation**: 5-10 points
  - Multiple independent paths converge
  - Example: Regnal span test

#### Supporting Evidence (0-20 points)
- **Manuscript Evidence**: 10-15 points
  - Older = more points
  - Unanimous = bonus
- **Secondary Sources**: 5-10 points
  - Contemporary historians
  - Archaeological evidence

#### Penalties (-5 to -20 points each)
- **Special Pleading Required**: -10 to -20 points
  - Unprecedented assumptions
  - Example: Zero-year ante-dating
- **Dismissing Explicit Statements**: -10 to -15 points
  - Ignoring clear evidence
  - Example: "27 years to the day"
- **Ignoring Evidence**: -5 to -10 points
  - Failing to address known facts
  - Example: Age calculation

#### Bonuses (+5 to +15 points)
- **Multiple Independent Lines**: +10 to +15 points
  - 3+ independent paths
- **Convergence**: +5 to +10 points
  - Different types of evidence agree
- **No Special Pleading**: +5 points
  - Natural fit, no ad hoc adjustments

---

## SCALABLE METRICS

### 1. Evidence Count
- **Number of independent lines**: Count primary + supporting
- **Quality-weighted count**: Sum of evidence scores
- **Convergence ratio**: Independent lines / total evidence

### 2. Source Quality Index
- **Age of sources**: Older = higher score
- **Unanimity**: Unanimous = bonus
- **Type diversity**: Multiple types = bonus

### 3. Contradiction Index
- **Number of contradictions**: Count conflicting evidence
- **Severity**: Weight by importance
- **Resolution**: Can contradictions be explained?

### 4. Special Pleading Index
- **Number of ad hoc assumptions**: Count required adjustments
- **Precedent**: Unprecedented = higher penalty
- **Complexity**: More complex = higher penalty

### 5. Convergence Score
- **Independent paths**: Count separate evidence streams
- **Type diversity**: Different evidence types
- **Cross-validation**: Evidence validates other evidence

---

## IMPLEMENTATION STRUCTURE

### Option A: Add to Existing Facts (Minimal Change)
Add scoring section to each fact:
```
### H13. Herod's Death
[existing content]
- **Evidence Score**: 87/100
  - Primary: 60, Supporting: 15, Penalties: -12, Bonuses: +12
- **Alternative Score**: 42/100 (4 BC claim)
```

### Option B: Separate Scoring Section (Clean Separation)
Keep facts as-is, add new section:
```
## EVIDENCE SCORING ANALYSIS

### H13. Herod's Death
- **Claim**: 1 BC
- **Score**: 87/100
- **Breakdown**: [detailed scoring]
- **Alternatives**: [comparison table]
```

### Option C: Hybrid (Recommended - Most Scalable)
1. **Keep existing fact structure** (for dependencies)
2. **Add scoring subsection** to each fact
3. **Add comparison section** at end for competing claims
4. **Create scoring rubric** as separate reference

---

## RECOMMENDED STRUCTURE (Option C - Hybrid)

### Part 1: Fact Dependency Tree (Current - Keep)
- All existing facts with dependencies
- Confidence levels (qualitative)
- Evidence lists

### Part 2: Evidence Scoring (NEW - Add to each fact)
- Numerical score (0-100)
- Breakdown by category
- Source quality metrics

### Part 3: Competing Claims Analysis (NEW - Separate section)
- Side-by-side comparison
- Numerical comparison
- Strength ratio calculation

### Part 4: Scoring Rubric (NEW - Reference section)
- Detailed point allocations
- Examples
- Application guidelines

---

## EXAMPLE IMPLEMENTATION

```markdown
## LEVEL 2: DERIVED HISTORICAL FACTS

### H13. Herod's Death
- **Fact**: 1 BC
- **Primary Evidence**: 
  - H5 (eclipse - January 10, 1 BC)
  - H11 + 70 years (age at death from birth year)
  - H12 + 34 years (de facto reign from capture)
  - H12g (regnal year span test)
- **Supporting Evidence**:
  - H8b (Philip's reign: 37 years from 1 BC = AD 35/36)
- **Dependencies**: H5, H11, H12, H12g, H8b
- **Confidence**: Very High

#### Evidence Scoring
- **Total Score**: 87/100
- **Primary Evidence** (60 points):
  - H5 (eclipse): 20 points
    - Astronomical precision: +10
    - Visibility/drama: +5
    - Timeline fit: +5
  - H11 (age): 15 points
    - Direct calculation: +8
    - Explicit statement: +5
    - Simple math: +2
  - H12 (capture + reign): 15 points
    - Explicit statement: +8
    - Precise calculation: +5
    - Natural fit: +2
  - H12g (regnal span): 10 points
    - Cross-validation: +8
    - Direct test: +2
- **Supporting Evidence** (15 points):
  - H8b (Philip): 15 points
    - Older manuscripts: +8
    - Unanimous: +4
    - Fits pattern: +3
- **Penalties** (-12 points):
  - H8a contradiction: -12 points
    - Requires special pleading: -8
    - Unprecedented: -4
- **Bonuses** (+12 points):
  - Multiple independent lines: +10
  - Convergence: +2

#### Alternative Comparison
- **4 BC Claim Score**: 42/100
  - Primary: 25 (eclipse partial, faint)
  - Supporting: 10 (Greek MSS, later)
  - Penalties: -28 (special pleading, dismissing statements)
  - Bonuses: +5 (some convergence)
- **Strength Ratio**: 87:42 = 2.07:1 (Book's claim 2.07x stronger)
```

---

## ADVANTAGES OF THIS STRUCTURE

1. **Scalable**: Can be applied to any fact/claim
2. **Objective**: Numerical scores are comparable
3. **Transparent**: Shows exactly how score is calculated
4. **Comprehensive**: Covers all aspects (evidence, penalties, bonuses)
5. **Comparable**: Side-by-side comparison of alternatives
6. **Maintainable**: Rubric can be refined without changing facts
7. **Flexible**: Can adjust weights as needed

---

## NEXT STEPS

1. **Create scoring rubric** with detailed point allocations
2. **Score all major facts** using the rubric
3. **Add alternative comparisons** for competing claims
4. **Create summary table** showing all scores
5. **Refine weights** based on testing

This structure allows for:
- **Objective comparison** between competing claims
- **Numerical evaluation** of argument strength
- **Scalable application** to any new fact or claim
- **Transparent methodology** that can be reviewed and refined
