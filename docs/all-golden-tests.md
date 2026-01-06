
# Golden Tests for Catty Trans

**Scope:** Core-domain, TM engine, diff engine  
**Audience:** AI coding agents + reviewers  
**Rule:** If a golden test fails, the change is rejected unless the test is explicitly revised with justification.

---

## How to Use These Golden Tests

- Implement them as:
    - Jest tests
    - Or executable specs
- Run them:
    - On every AI-generated PR
    - Before refactors
- Do **not** loosen assertions to “make tests pass”

---

# A. Core Domain Invariants

---

## G1 — Snapshot Immutability

**Scenario**  
A project state is snapshotted, then further changes occur.

**Given**

- ProjectState at Snapshot S1
- A later Snapshot S2 exists

**When**

- S2 is committed
- State is modified again

**Then**

- Snapshot S1’s data must be byte-for-byte identical to original
- No reference equality to mutable structures

**Why this must never break**

- Rollback trust collapses instantly

---

## G2 — Rollback Is Exact, Not Approximate

**Scenario**  
A translator rolls back after a mistake.

**Given**

- State at Snapshot S1
- Changes leading to S2 and S3

**When**

- Rollback to S1 is executed

**Then**

- Resulting state equals S1 exactly
- No residual metadata, flags, or counters from later states

**Failure this catches**

- “Almost rollback” implementations
- Hidden side effects

---

## G3 — No Silent State Mutation

**Scenario**  
A function applies a change.

**Given**

- Original ProjectState object

**When**

- applyChange(originalState, change) is called

**Then**

- originalState is unchanged
- Returned state is a new object

**Failure this catches**

- Accidental mutation
- Performance shortcuts that destroy determinism

---

# B. Client Isolation & TM Safety

---

## G4 — Cross-Client TM Promotion Is Blocked

**Scenario**  
A segment from Client A is reused in Client B.

**Given**

- TMEntry belonging to Client A
- Project belonging to Client B

**When**

- canPromoteSegment is evaluated

**Then**

- allowed === false
- reason explicitly references cross-client risk

**Why this must never break**

- This is an IP leak, not a bug

---

## G5 — Ad-Hoc Projects Do Not Pollute TM

**Scenario**  
A rush job finishes late at night.

**Given**

- Project marked as ad-hoc
- Completed segments

**When**

- TM promotion is attempted

**Then**

- Promotion denied by default
- Override required and logged

**Failure this catches**

- “Helpful” defaults that cause long-term damage

---

## G6 — TM Entries Are Immutable

**Scenario**  
TM grows over time.

**Given**

- TMEntry E1 created from Snapshot S1

**When**

- Later project edits occur
- TM is queried

**Then**

- E1 content remains unchanged
- Any correction produces a _new_ TMEntry

**Why**

- Provenance must remain defensible

---

# C. TM Query Determinism

---

## G7 — Same Query, Same Result

**Scenario**  
Translator reopens a project days later.

**Given**

- TM state unchanged
- Same TMQuery input

**When**

- Query is executed twice

**Then**

- Results are identical
- Order, matchType, and provenance unchanged

**Failure this catches**

- Hidden randomness
- Order instability from indexing changes

---

## G8 — TM Match Provenance Is Explainable

**Scenario**  
Client disputes wording.

**Given**

- TMMatchResult returned

**Then**

- Result includes:
    - Source project ID
    - Snapshot ID
    - Timestamp
- No “unknown source” placeholders unless explicitly flagged

**Why**

- “The system suggested it” is not defensible

---

# D. Diff Engine Truthfulness

---

## G9 — Diff Always Explains “What Changed”

**Scenario**  
A segment is edited.

**Given**

- Before and after SegmentState

**When**

- diffSegment is called

**Then**

- Diff includes:
    - Before value
    - After value
    - Change category

**Failure this catches**

- Vague diffs
- Cosmetic-only output

---

## G10 — Diff Does Not Invent Reasons

**Scenario**  
Change provenance is unclear.

**Given**

- Segment changed
- No TM or terminology involvement

**Then**

- Diff must state “manual edit” or “unknown”
- Must not guess TM influence

**Why**

- Guessing breaks trust faster than silence

---

## G11 — TM-Driven Changes Are Distinguishable

**Scenario**  
TM suggestion is accepted.

**Given**

- Segment change caused by TM insertion

**Then**

- Diff marks TM involvement explicitly
- References TMEntry provenance

**Failure this catches**

- “Magic” automation behaviour

---

# E. Failure & Degradation Behaviour

---

## G12 — Partial Diff Is Labelled as Partial

**Scenario**  
Diff exceeds performance limits.

**Given**

- Large project
- Diff computation exceeds threshold

**Then**

- Diff result includes:
    - isPartial === true
    - Explanation of what is missing

**Why**

- Silent truncation destroys trust

---

## G13 — Corrupted Artefact Blocks Progress

**Scenario**  
Disk write interrupted.

**Given**

- Snapshot checksum mismatch

**When**

- Project loads

**Then**

- System refuses to proceed
- Recovery options presented
- No auto-repair

**Failure this catches**

- “Best effort” recovery that hides damage

---

# F. Architectural Guardrails (AI-Specific)

---

## G14 — core-domain Has No IO

**Scenario**  
AI adds convenience logic.

**Given**

- `/core-domain` directory

**Then**

- No imports of:
    - fs
    - sqlite
    - network libraries
- Test fails if detected

**Why**

- One violation poisons the architecture

---

## G15 — Domain Logic Is Adapter-Agnostic

**Scenario**  
Storage implementation changes.

**Given**

- core-domain logic

**Then**

- No SQLite-specific assumptions
- No Postgres-specific fields

**Failure this catches**

- Web migration blockers

---

# G. Meta Golden Test

---

## G16 — Explainability Test (Human-Readable)

**Scenario**  
Reviewer inspects artefacts.

**Given**

- On-disk project folder
- TM files
- Snapshot metadata

**Then**

- A human can answer:
    - What changed?
    - When?
    - Why?
    - From where?

**This is not optional.**

---

# How to Enforce This With AI Agents

Add this rule to your governance prompt:

> “If a change risks breaking a golden test, you must call it out explicitly before writing code.”

And in CI:

- Golden tests run **before** normal tests
- Failure blocks merge

---

## What These Golden Tests Buy You

- AI speed without AI chaos
- Refactors without fear
- Web expansion without rewrite
- Translator trust under deadline pressure
