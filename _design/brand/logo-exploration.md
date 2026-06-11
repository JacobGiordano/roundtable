# Roundtable Logo Mark Exploration

**Owner:** Marque  
**Status:** Decision made — R1 adopted  
**Last updated:** 2026-06-11  
**Issue:** Logo mark re-evaluation — current flat-top hexagon reads as bolt/nut

---

## Decision

**Selected direction: Option R1 — Ring + Seat Dots**

R1 was not one of the numbered options in this exploration document — it synthesizes the ring from Option 3b and the six seat dots from Option 4, combining them so the dots straddle the ring rather than floating free of it.

**R1 geometry (authoritative):**
- Outer circle: cx=24 cy=24, r=22, fill=#2D2B55
- Ring (table surface): cx=24 cy=24, r=14, fill=none, stroke=white, stroke-width=2
- Six seat dots: r=3 each, fill=white, centered on the ring at pointy-top hexagonal positions — (24,10), (36.12,17), (36.12,31), (24,38), (11.88,31), (11.88,17)
- Center dot: cx=24 cy=24, r=3.5, fill=white

**Why R1 over the numbered options:**

The exploration correctly identified Option 4 (seat dots) as the most narratively compelling but disqualified it at 16px — dots at r=2.5 are sub-pixel at favicon scale. R1 addresses this: the ring provides a second visual element that survives at small sizes, so the mark reads as a circle badge with a secondary ring at 16–24px, and as ring-plus-dots above 32px.

R1 also resolves the core tension identified in this document: Roundtable is round, and the hexagon (in any orientation) is a hexagon. R1 removes the hexagon entirely. Ring = table surface. Dots = seats/participants. Center = shared conversation. Every element is a circle. The mark requires no explanation.

The "six participants at defined positions" reading from Options 4, 10a, and 10b is preserved — the dots are still at the six hexagonal positions, which is enough structure to communicate deliberate arrangement without an angular polygon defining it.

**Implementation:** `_design/brand/identity.md` and all five logo SVGs updated. Aria to update `/src/ui/` React logo component to match. No palette, token, or typeface changes.

---

## Problem Statement

The current mark places a flat-top hexagon inside the filled circle. In practice, the flat-top hexagon orientation — wide horizontal faces at top and bottom, vertices pointing left and right — is the exact visual grammar of an industrial bolt or hex nut viewed from above. The identity.md rationale correctly reads the hexagon as "six equal seats, a table surface viewed from above," but the visual reads bolt before it reads table.

A secondary issue raised by the user: a product called **Roundtable** whose inner mark has flat sides carries an internal contradiction. If the brand positioning is "closed, continuous, no head of the table," a form that reads as hexagonal hardware works against that. This exploration examines alternatives and documents which resolves the problem most cleanly.

The constraints from `identity.md` that are fixed and not under review here:

- 48-unit grid, `cx=24 cy=24`
- Outer circle: `r=22`, filled, `#2D2B55` Roundtable Indigo
- Center dot: `r=3`, white `#FFFFFF`
- All interior marks: white `#FFFFFF`, `stroke-width="2"` where stroked

---

## Option 1 — Current Mark (Flat-Top Hexagon)

**Retain as-is with documented rationale**

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" width="96" height="96">
  <title>Roundtable — Option 1: Flat-Top Hexagon</title>
  <circle cx="24" cy="24" r="22" fill="#2D2B55"/>
  <polygon
    points="38,24 31,36.12 17,36.12 10,24 17,11.88 31,11.88"
    fill="none"
    stroke="#FFFFFF"
    stroke-width="2"
    stroke-linejoin="round"
  />
  <circle cx="24" cy="24" r="3" fill="#FFFFFF"/>
</svg>

**Geometry:** Hexagon inscribed at r=14, first vertex at 0° (right), flat faces top and bottom. Vertices at (38,24), (31,36.12), (17,36.12), (10,24), (17,11.88), (31,11.88).

**Mark concept:** The hexagon represents six equal seats at a table viewed from above. The flat-top orientation was chosen as the canonical orientation for a table surface metaphor — a stable, horizontal base.

**Brand positioning fit:** The "equal seats" reading is legitimate and well-documented. Six vertices = six equal positions. No head of table. The center dot anchors the common ground.

**Tradeoffs:**
- The flat-top hexagon is indistinguishable from a bolt/hex nut in fast visual processing. This is the orientation used in every hardware icon, every settings gear's cousin, every engineering schematic.
- At 16px favicon scale: reads as a circle badge. The hexagon interior collapses. This is fine per the identity spec but means the mark doesn't carry meaningful information at its smallest size.
- The product name "Roundtable" creates cognitive dissonance with a shape that has flat horizontal edges. A round table has no flat sides.
- The identity.md currently lists "Rotating or reflecting the mark" as a forbidden use, with the specific rationale that "Rotation produces a pointy-top hexagon which breaks the constructed table metaphor." This assumes the table metaphor only works flat-top. That assumption should be interrogated before being locked in as a rule.

**Verdict:** The rationale is defensible in isolation. The execution fails in context — the bolt/nut reading is real, and the flat-face contradiction with "round" is real. This direction should be retired unless it tests well against actual users who haven't seen the rationale document.

---

## Option 2 — Pointy-Top Hexagon (30° Rotation)

**Rotate the hexagon to vertex-up/vertex-down orientation**

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" width="96" height="96">
  <title>Roundtable — Option 2: Pointy-Top Hexagon</title>
  <circle cx="24" cy="24" r="22" fill="#2D2B55"/>
  <polygon
    points="24,10 36.12,17 36.12,31 24,38 11.88,31 11.88,17"
    fill="none"
    stroke="#FFFFFF"
    stroke-width="2"
    stroke-linejoin="round"
  />
  <circle cx="24" cy="24" r="3" fill="#FFFFFF"/>
</svg>

**Geometry:** Same hexagon at r=14, rotated 30°. First vertex at 90° (top). Vertices at (24,10), (36.12,17), (36.12,31), (24,38), (11.88,31), (11.88,17).

**Mark concept:** The vertical axis of symmetry (point at top, point at bottom) breaks the bolt/nut reading immediately. Industrial bolt heads are always depicted flat-top. The pointy-top version reads as a gem, a cell in a honeycomb, a directional marker — none of which is ideal, but none is "bolt."

**Brand positioning fit:** Loses some of the "table surface" reading because a flat top more directly implies a table. However: the hexagon is still six equal vertices, still inscribed in a circle, still structured. The "equal voices" meaning lives in the number of sides and the circle containment, not specifically in the flat-top orientation. The center dot continues to anchor the gathering point.

**Tradeoffs:**
- Removes the bolt/nut reading effectively.
- Gains a very faint gem/crystal association (pointy-top hexagons read as crystals in some visual contexts). This is minor and far less distracting than the bolt reading.
- The top-and-bottom points create a vertical axis that conflicts subtly with the circle's perfect rotational symmetry — it introduces a "top" and "bottom" to a mark that is supposed to have no head. This is a philosophical issue, not a visual one, and a skeptical reading.
- At 16px: same as option 1 — collapses to a circle badge. No regression.
- Requires updating the forbidden-uses rule in `identity.md` — the current prohibition on "rotating or reflecting the mark" was written specifically to prohibit this rotation. If this option is chosen, that rule inverts: pointy-top becomes canonical, flat-top becomes forbidden.

**Verdict:** A material improvement on the bolt problem. The six-equal-vertices meaning is preserved. The philosophical concern about introducing a top/bottom axis is real but minor at the visual level — the overall form is still perfectly circular in containment. This is the strongest conservative change — minimal redesign, maximum improvement.

---

## Option 3 — Pure Concentric Rings

**Remove the hexagon entirely; replace with concentric circle strokes**

**3a — Three rings:**

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" width="96" height="96">
  <title>Roundtable — Option 3a: Concentric Rings (three)</title>
  <circle cx="24" cy="24" r="22" fill="#2D2B55"/>
  <circle cx="24" cy="24" r="14" fill="none" stroke="#FFFFFF" stroke-width="2"/>
  <circle cx="24" cy="24" r="7" fill="none" stroke="#FFFFFF" stroke-width="2"/>
  <circle cx="24" cy="24" r="3" fill="#FFFFFF"/>
</svg>

**3b — Two rings (recommended variant):**

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" width="96" height="96">
  <title>Roundtable — Option 3b: Concentric Rings (two)</title>
  <circle cx="24" cy="24" r="22" fill="#2D2B55"/>
  <circle cx="24" cy="24" r="14" fill="none" stroke="#FFFFFF" stroke-width="2"/>
  <circle cx="24" cy="24" r="3" fill="#FFFFFF"/>
</svg>

**Geometry (3b):** Outer filled circle r=22. Single inner ring r=14, stroke=2. Center dot r=3.

**Mark concept:** Three concentric circles — one filled, one stroked, plus the center dot — read as ripples, as layers of conversation radiating from a center point. The "round" in Roundtable is maximally expressed: every element is round. The table metaphor shifts from "hexagonal surface from above" to "the table edge," with the center dot as the gathering point.

**Brand positioning fit:** Strongest possible alignment with the product name. Zero angular forms. The equal-voices reading shifts from "six vertices = six seats" to "every point on this ring is equally far from center" — which is actually a more rigorous expression of equality. No head, no flat side, no top or bottom.

**Tradeoffs:**
- Loses the explicit "six participants" reading. Concentric rings suggest infinite or unspecified participants, which is arguably more accurate for a multi-model AI interface (models will be added over time) but less precisely structured.
- Similarity risk: target/crosshair symbols, the Japan flag structure, a bull's-eye, and various sports logos all use concentric circles. This is a more generic geometric form.
- At 16px: excellent. The thin inner ring reads as a visible secondary circle even at small sizes.
- Three-ring variant (3a) is complex at mid-sizes. The two-ring variant (3b) is cleaner.
- This is a larger conceptual departure from the hexagonal mark than options 2 and 7.

**Verdict:** The two-ring variant (3b) is brand-coherent and clean. The tradeoff is loss of the constructed hexagonal structure that signals "this is designed and deliberate." Concentric rings can read as placeholder or generic. Appropriate only if the brand is confident enough in the wordmark and color to carry specificity.

---

## Option 4 — Seat Dots

**Replace the hexagon stroke with six dots arranged at hexagonal positions**

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" width="96" height="96">
  <title>Roundtable — Option 4: Six Seat Dots</title>
  <circle cx="24" cy="24" r="22" fill="#2D2B55"/>
  <!-- Six dots at r=14, pointy-top arrangement (first dot at top) -->
  <!-- Top:         (24,    10)    -->
  <!-- Upper-right: (36.12, 17)   -->
  <!-- Lower-right: (36.12, 31)   -->
  <!-- Bottom:      (24,    38)   -->
  <!-- Lower-left:  (11.88, 31)   -->
  <!-- Upper-left:  (11.88, 17)   -->
  <circle cx="24"    cy="10"    r="2.5" fill="#FFFFFF"/>
  <circle cx="36.12" cy="17"    r="2.5" fill="#FFFFFF"/>
  <circle cx="36.12" cy="31"    r="2.5" fill="#FFFFFF"/>
  <circle cx="24"    cy="38"    r="2.5" fill="#FFFFFF"/>
  <circle cx="11.88" cy="31"    r="2.5" fill="#FFFFFF"/>
  <circle cx="11.88" cy="17"    r="2.5" fill="#FFFFFF"/>
  <circle cx="24"    cy="24"    r="3"   fill="#FFFFFF"/>
</svg>

**Geometry:** Six filled circles, r=2.5 each, at r=14 from center on the pointy-top hexagonal vertex grid. Center dot r=3.

**Mark concept:** Six dots surrounding a center point — each dot is a participant, a model, a voice at the table. The center dot is the shared conversation. The dots suggest the hexagonal arrangement without the stroked polygon connecting them.

**Brand positioning fit:** The most literal and immediate expression of the brand. You see six somethings arranged in a circle around a center. The round-table metaphor requires zero explanation.

**Tradeoffs:**
- Critical failure at 16px: dots at r=2.5 render at 0.83px radius at 16px display size — sub-pixel, invisible. This disqualifies the option at the current constraint set.
- Dots would need r=3.5–4 to survive at 32px, creating crowding at full size.
- Risk of reading as a cellular pattern or loading indicator (progress dots in orbit).

**Verdict:** Most narratively rich. Fails the 16px size constraint. Not recommended under current identity rules without a policy change on minimum size requirements. Worth revisiting if the favicon specification is updated to permit a simplified badge variant at 16px (filled circle only, no interior detail required).

---

## Option 5 — Thick Annular Ring (Table Thickness)

**Replace the hexagon stroke with a thick ring suggesting the table surface's physical edge**

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" width="96" height="96">
  <title>Roundtable — Option 5: Thick Annular Ring</title>
  <circle cx="24" cy="24" r="22" fill="#2D2B55"/>
  <circle cx="24" cy="24" r="14" fill="none" stroke="#FFFFFF" stroke-width="5"/>
  <circle cx="24" cy="24" r="3" fill="#FFFFFF"/>
</svg>

**Geometry:** Outer circle r=22 filled. Single thick ring r=14, stroke-width=5 (spanning r=11.5 to r=16.5). Center dot r=3.

**Mark concept:** The thick ring reads as the edge of a round table viewed from directly above — a table surface with discernible physical thickness. The center dot is the common gathering point.

**Tradeoffs:**
- The outer circle + thick inner ring + center dot creates a gunsight/scope-reticle association that is difficult to unsee.
- Two competing mass elements (thick ring + filled dot) without clear visual hierarchy.
- Loses the constructed/specific quality of the hexagonal form.

**Verdict:** Not recommended. The gunsight reading is disqualifying. The two-ring version (3b) achieves the same "round table" reading with better visual hierarchy and no undesirable associations.

---

## Option 6 — Seat Arc (Open Ring with Gap)

**A ring that almost closes — one seat left open, conversation ongoing**

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" width="96" height="96">
  <title>Roundtable — Option 6: Seat Arc</title>
  <circle cx="24" cy="24" r="22" fill="#2D2B55"/>
  <!--
    Arc at r=14, nearly complete circle with a 20° gap at top (270° = 12 o'clock).
    Circumference = 2π×14 ≈ 87.96 units.
    20° gap = 87.96 × (20/360) ≈ 4.89 units.
    Offset 19.55 positions the gap at the top.
  -->
  <circle
    cx="24" cy="24" r="14"
    fill="none"
    stroke="#FFFFFF"
    stroke-width="2"
    stroke-dasharray="83.07 4.89"
    stroke-dashoffset="19.55"
    stroke-linecap="round"
  />
  <circle cx="24" cy="24" r="3" fill="#FFFFFF"/>
</svg>

**Geometry:** Ring at r=14, stroke=2, with a 20° gap at 12 o'clock. Implemented via `stroke-dasharray="83.07 4.89"`, offset=19.55.

**Mark concept:** An almost-complete circle. The gap is the door — the table is not closed to new participants.

**Tradeoffs:**
- The gap at 12 o'clock creates an implicit "head of the table" — the one thing the brand positioning explicitly rejects.
- At 16px: the gap (1.1px wide) will not render. The mark reads as a complete ring, losing its differentiating concept at the most-needed size.
- Near-universal association with loading spinners and progress indicators. A nearly-complete ring inside a dark circle is the UI loading pattern.

**Verdict:** Not recommended. The loading-spinner association is disqualifying. The implicit head-of-table at the gap position contradicts the core brand claim.

---

## Option 7 — Rounded-Vertex Hexagon (Pointy-Top)

**Option 2 with rounded joins — removes the mechanical precision of hard hex angles**

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" width="96" height="96">
  <title>Roundtable — Option 7: Rounded Hexagon (Pointy-Top)</title>
  <circle cx="24" cy="24" r="22" fill="#2D2B55"/>
  <polygon
    points="24,10 36.12,17 36.12,31 24,38 11.88,31 11.88,17"
    fill="none"
    stroke="#FFFFFF"
    stroke-width="3"
    stroke-linejoin="round"
    stroke-linecap="round"
  />
  <circle cx="24" cy="24" r="3" fill="#FFFFFF"/>
</svg>

**Geometry:** Pointy-top hexagon (same vertices as Option 2), stroke-width=3, `stroke-linejoin="round"`. The increased stroke weight makes rounding visible and intentional at ≥48px render size.

**Mark concept:** The hexagonal seat count and pointy-top orientation from Option 2, with rounded joints. The softer corners read as "hexagonal, but not a bolt" — bolts are never drawn with rounded joins. The form communicates structure with a conversational quality.

**Brand positioning fit:** Same as Option 2. Six equal vertices, contained in a circle, center dot as gathering point. The rounding adds warmth without losing structure.

**Tradeoffs:**
- The heavier stroke (3px vs 2px) causes the hexagon interior to collapse at a slightly larger size — around 20–22px rather than 16px. At 16px it still reads as a circle badge.
- `stroke-linejoin="round"` is nearly imperceptible at stroke-width=2. The rounding only becomes meaningful at stroke-width=3+, which carries the small-size tradeoff.
- Slightly less precise than the hard-angle version. The brand brief specifies "constructed, not playful" — the rounded version moves slightly toward warmth.

**Verdict:** A valid refinement of Option 2. Softer reading, less engineered precision. Whether this is desirable depends on whether the brand leans "precise/constructed" (keep hard angles, Option 2) or "collaborative/warm" (round the corners, Option 7). Both are defensible; both solve the bolt problem.

---

---

## Option 8 — Rounded Hexagon + Semicircular Seat Arcs on Each Side

**Option 7's rounded-vertex pointy-top hexagon, with semicircular seat arcs centered on each side**

This option combines three prior elements: Option 2's pointy-top orientation, Option 7's rounded stroke joins, and Option 4's "seat" concept — expressed here not as vertex dots but as semicircular arcs centered on each side midpoint, with the diameter flush along the hexagon side.

The diameter of each semicircle equals one full side of the hexagon (14 units); the semicircle radius is 7. Each arc's endpoints are exactly the two vertices that share that side. Two sub-variants are explored: arc bowing inward (toward center) and arc bowing outward (away from center).

**Geometry derivation:** Hexagon side midpoints are at apothem distance 12.12 from center (r=14 * cos 30°). Inward arc peaks sit at r=5.12 from center (12.12 - 7). Outward arc peaks sit at r=19.12 from center (12.12 + 7), leaving 2.88 units of clearance before the outer circle edge (r=22). All six inward arcs use SVG arc sweep=0 (counterclockwise); outward arcs use sweep=1.

**8a — Inward arcs (arcs bow toward center):**

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" width="96" height="96">
  <title>Roundtable — Option 8a: Rounded Hexagon + Inward Seat Arcs</title>
  <circle cx="24" cy="24" r="22" fill="#2D2B55"/>
  <!-- Rounded pointy-top hexagon outline -->
  <polygon
    points="24,10 36.12,17 36.12,31 24,38 11.88,31 11.88,17"
    fill="none"
    stroke="#FFFFFF"
    stroke-width="3"
    stroke-linejoin="round"
    stroke-linecap="round"
  />
  <!--
    Six inward seat arcs. Each arc spans one hexagon side (r=7, diameter=14=side length).
    Endpoints are the two vertices sharing that side.
    sweep=0 (counterclockwise from v_i to v_{i+1}) bows arc toward center (24,24).
    Inward bow points sit at r=5.12 from center — all arcs converge near the center dot.
  -->
  <path d="M 24,10 A 7,7 0 0,0 36.12,17" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
  <path d="M 36.12,17 A 7,7 0 0,0 36.12,31" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
  <path d="M 36.12,31 A 7,7 0 0,0 24,38" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
  <path d="M 24,38 A 7,7 0 0,0 11.88,31" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
  <path d="M 11.88,31 A 7,7 0 0,0 11.88,17" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
  <path d="M 11.88,17 A 7,7 0 0,0 24,10" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
  <circle cx="24" cy="24" r="3" fill="#FFFFFF"/>
</svg>

**Visual assessment — inward arcs:** The inward variant has a structural problem: all six arc peaks land at r=5.12 from center. That is 2.12 units beyond the center dot edge (r=3). At 96px render size the six arcs converge into a tight star formation around the center dot — the interior collapses into dense, overlapping curves. The hexagon outline and the arcs read as competing systems rather than integrated geometry. The "seat" reading does not survive the density; the form reads more as a six-pointed asterisk or flower pressed flat. At 16px: indistinguishable noise. The inward direction is not viable.

**8b — Outward arcs (arcs bow away from center — recommended sub-variant):**

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" width="96" height="96">
  <title>Roundtable — Option 8b: Rounded Hexagon + Outward Seat Arcs</title>
  <circle cx="24" cy="24" r="22" fill="#2D2B55"/>
  <!-- Rounded pointy-top hexagon outline -->
  <polygon
    points="24,10 36.12,17 36.12,31 24,38 11.88,31 11.88,17"
    fill="none"
    stroke="#FFFFFF"
    stroke-width="3"
    stroke-linejoin="round"
    stroke-linecap="round"
  />
  <!--
    Six outward seat arcs. Same endpoints as 8a.
    sweep=1 (clockwise from v_i to v_{i+1}) bows arc AWAY from center.
    Outward bow points sit at r=19.12 from center, with 2.88 units clearance
    before the outer circle edge (r=22). Each arc occupies its own bay between
    hexagon side and outer circle boundary.
  -->
  <path d="M 24,10 A 7,7 0 0,1 36.12,17" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
  <path d="M 36.12,17 A 7,7 0 0,1 36.12,31" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
  <path d="M 36.12,31 A 7,7 0 0,1 24,38" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
  <path d="M 24,38 A 7,7 0 0,1 11.88,31" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
  <path d="M 11.88,31 A 7,7 0 0,1 11.88,17" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
  <path d="M 11.88,17 A 7,7 0 0,1 24,10" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
  <circle cx="24" cy="24" r="3" fill="#FFFFFF"/>
</svg>

**Geometry (8b):** Rounded pointy-top hexagon (stroke-width=3, stroke-linejoin="round") plus six arc paths with r=7, sweep=1, nested between hexagon sides and outer circle. Each arc peak sits at r=19.12 from center with 2.88 units clearance to the outer fill edge. Center dot r=3.

**Visual assessment — outward arcs:** The outward variant is materially more readable. Each arc occupies its own distinct territory — the bay between its hexagon side and the outer circle boundary. Six separate seat-shaped pockets appear around the perimeter, one per side. The interior remains clear: only the hexagon outline and center dot. The seat-at-a-table reading lands — each arc reads as a chair back, curved to face inward, one per side. The form is the most narratively explicit mark in this entire exploration.

The remaining tension: each hexagon vertex is now the shared endpoint of two arc paths and two polygon edges — a four-line convergence point. At 96px, these vertex nodes are visible and read as structural joints. At 48px they become heavy. The combined stroke weight at each vertex (polygon stroke-width=3 plus arc stroke-width=2) creates a marked emphasis at the six corners. This could be a visual asset (emphasizing the seat positions) or a defect (irregular weight distribution), depending on the reader.

**Brand positioning fit (8b):** The seat concept is fully integrated into the geometry — the arcs are not decoration added to the hexagon, they are the hexagon's sides re-expressed as chair backs. This reads as: a table with six seats, built into the structure of the mark. The product name "Roundtable," the equal-voice positioning, and the visual form all point in the same direction. No other option in this exploration makes the seat metaphor this explicit.

**Tradeoffs:**
- Three overlapping geometric systems (outer circle, hexagon outline, seat arcs) make this the most complex mark in the set. At 96px+ the systems are legible individually. At 48px they merge. At 16px: collapses to a circle badge — no regression from Options 2/7, but no gain either.
- Outward arcs approach but do not clip the outer circle (2.88 units clearance). This is sufficient at 48px base canvas. At very small sizes, anti-aliasing could create perceived clipping — document in implementation notes if this direction proceeds.
- The hexagon outline may be redundant: the arcs already define all six sides by sharing endpoints at every vertex. A mark with arcs only (no polygon outline) is a distinct variation that could be cleaner — not explored here.
- Vertex node weight: where arc endpoints and polygon corners converge, stroke overlap creates visual emphasis. Intentional or not, this will need to be evaluated in a rendered browser environment.

**Verdict:** 8a (inward) is disqualified — interior crowding is real and unresolvable at the current size constraints. 8b (outward) earns consideration as an alternative to Options 2 and 7 if explicit seat-at-a-table narrative is a priority. It is not the recommended primary direction because the three-system complexity is high relative to clarity gained over the simpler hexagon-only marks. But it is the strongest conceptual statement in this exploration and worth keeping on the table for contexts where the mark has room to breathe.

---

## Option 9 — Spoke Lines: Hexagon Vertices to Center Circle

**Six straight white lines connecting each hexagon vertex to the edge of the center dot**

A hub-and-spoke structure. Each line runs from one vertex of the pointy-top hexagon (r=14) to the nearest point on the center circle (r=3) in the radial direction.

Endpoint derivation: for vertex (vx, vy), the spoke inner endpoint = (24 + 3*(vx-24)/14, 24 + 3*(vy-24)/14).

| Vertex | Outer end | Inner end |
|--------|-----------|-----------|
| Top (24, 10) | (24, 10) | (24, 21) |
| Upper-right (36.12, 17) | (36.12, 17) | (26.60, 22.50) |
| Lower-right (36.12, 31) | (36.12, 31) | (26.60, 25.50) |
| Bottom (24, 38) | (24, 38) | (24, 27) |
| Lower-left (11.88, 31) | (11.88, 31) | (21.40, 25.50) |
| Upper-left (11.88, 17) | (11.88, 17) | (21.40, 22.50) |

**9a — Spokes with hexagon outline:**

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" width="96" height="96">
  <title>Roundtable — Option 9a: Spokes with Hexagon Outline</title>
  <circle cx="24" cy="24" r="22" fill="#2D2B55"/>
  <!-- Pointy-top hexagon outline -->
  <polygon
    points="24,10 36.12,17 36.12,31 24,38 11.88,31 11.88,17"
    fill="none"
    stroke="#FFFFFF"
    stroke-width="2"
    stroke-linejoin="round"
  />
  <!--
    Six spokes from hexagon vertex to center circle edge.
    Outer end: hexagon vertex at r=14.
    Inner end: center circle edge at r=3, in direction of that vertex.
    Formula: inner = (24 + 3*(vx-24)/14, 24 + 3*(vy-24)/14)
  -->
  <line x1="24" y1="10" x2="24" y2="21" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="36.12" y1="17" x2="26.60" y2="22.50" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="36.12" y1="31" x2="26.60" y2="25.50" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="24" y1="38" x2="24" y2="27" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="11.88" y1="31" x2="21.40" y2="25.50" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="11.88" y1="17" x2="21.40" y2="22.50" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="24" cy="24" r="3" fill="#FFFFFF"/>
</svg>

**9b — Spokes only (no hexagon outline):**

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" width="96" height="96">
  <title>Roundtable — Option 9b: Spokes Only (No Hexagon)</title>
  <circle cx="24" cy="24" r="22" fill="#2D2B55"/>
  <!--
    Spokes only — no hexagon polygon.
    Same endpoints as 9a but stroke-width=2 (no hexagon to establish hierarchy against).
  -->
  <line x1="24" y1="10" x2="24" y2="21" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
  <line x1="36.12" y1="17" x2="26.60" y2="22.50" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
  <line x1="36.12" y1="31" x2="26.60" y2="25.50" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
  <line x1="24" y1="38" x2="24" y2="27" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
  <line x1="11.88" y1="31" x2="21.40" y2="25.50" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
  <line x1="11.88" y1="17" x2="21.40" y2="22.50" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
  <circle cx="24" cy="24" r="3" fill="#FFFFFF"/>
</svg>

**Mark concept:** A wheel. Six spokes meeting at a hub. The form is ancient and immediately legible — a wheel is a round-table structure with radii. The center dot is the axle, the common gathering point. Each spoke is a voice, a participant, a model connected to the shared center.

**Brand positioning fit:** This is where the option encounters a hard conceptual problem. Roundtable's brand positioning is explicitly "no head of the table" — equal voices, no hierarchy, no privileged position. A hub-and-spoke structure communicates the direct opposite. The center is the most privileged element in a spoke diagram; every node connects through it; nothing connects peer-to-peer. This is accurate as a technical description of how the Roundtable UI works (messages route through the app to multiple models) but is exactly the framing the brand identity should avoid.

The center dot in all prior options has been interpreted as a passive element — the empty center of a round table, a shared gathering point, not a seat of authority. Spokes running to that dot promote it from "empty center" to "hub/server/authority." The metaphor shifts from "round table" to "wheel" or "star topology network." For a product that exists to give equal platform to multiple AI voices, this is the wrong grammar.

**Visual assessment — 9a (spokes + hexagon):** At 96px the mark reads as a wheel inside a hexagon inside a circle — three distinct systems, complex but structured. The spoke lines (stroke-width=1.5) are lighter than the hexagon outline (stroke=2), which is appropriate hierarchy. The interior is busy; the center dot reads as a hub. The overall form resembles a dartboard sector diagram or a mechanical component cross-section. Distinctive, but in a technical-diagram direction rather than a conversation-interface direction.

**Visual assessment — 9b (spokes only):** Without the hexagon, the six lines radiate from a center dot to six floating endpoints. At 96px the form reads as a starburst or asterisk — the outer endpoints are not connected, so the perimeter is implied rather than stated. The "round" element is entirely absent; closure comes only from the outer circle, which is too far from the spoke tips to feel integrated. At 48px: white starburst on indigo, which reads as compass or loading indicator. At 16px: indistinct radiating marks around a center point — worse than Options 2 or 7.

**Comparison within Option 9:**

| Criterion | 9a (with hexagon) | 9b (spokes only) |
|-----------|:-----------------:|:----------------:|
| Hub hierarchy problem | Yes — severe | Yes — severe |
| 16px legibility | Circle badge | Ambiguous blur |
| Distinctiveness | Moderate (wheel/dartboard) | Low (starburst) |
| Brand name fit | Wheel — not table | Starburst — not table |
| Interior complexity | High | Moderate |

**Tradeoffs:**
- The hub-and-spoke architecture is antithetical to the "no head of the table" brand positioning. This is a conceptual mismatch — not a visual problem solvable by refinement.
- 9a is graphically more interesting than 9b; 9b is cleaner but loses round structure entirely.
- Neither sub-variant resolves the hub hierarchy problem. The issue is structural, not cosmetic.
- The spoke mark communicates well for a product that is genuinely hub-centric: a router, a connector, an orchestration layer. Roundtable's brand positioning is the opposite of that.

**Verdict:** Not recommended. The hub-and-spoke structure directly contradicts Roundtable's "no head of the table" claim. In brand identity, communicating the wrong concept clearly is worse than ambiguity — a viewer who reads this mark correctly reads hierarchy, not equality. Options 2 and 7 preserve the hexagonal six-position structure without introducing center-outward hierarchy. Option 9 should not be revisited unless the brand positioning changes.

---

## Option 10a — Pointy-Top Hexagon with Knockout Vertex Dots

**Options 2 + 4 combined: the hexagon stroke with six dots at each vertex that appear to punch through the stroke**

The concept: take the pointy-top hexagon from Option 2 (stroke-width=2, stroke-linejoin="round") and place six filled circles at each vertex using the background color (`#2D2B55`). The filled circles sit on top of the white stroke, masking it at each vertex. The visual effect is that the hexagon stroke terminates at each dot — creating six distinct node endpoints that interrupt the continuous line, suggesting six discrete participants meeting at defined positions rather than a continuous perimeter.

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" width="96" height="96">
  <title>Roundtable — Option 10a: Pointy-Top Hexagon, Knockout Vertex Dots</title>
  <circle cx="24" cy="24" r="22" fill="#2D2B55"/>
  <!--
    Pointy-top hexagon stroke: white, stroke-width=2, stroke-linejoin=round.
    Vertices at r=14, first at 90° (top).
  -->
  <polygon
    points="24,10 36.12,17 36.12,31 24,38 11.88,31 11.88,17"
    fill="none"
    stroke="#FFFFFF"
    stroke-width="2"
    stroke-linejoin="round"
  />
  <!--
    Six vertex dots filled with the background color (#2D2B55).
    Painted on top of the hexagon stroke — they read as holes punched through
    the white line. The stroke terminates visually at each dot edge.
    Dot radius r=2.5.
  -->
  <circle cx="24"    cy="10"    r="2.5" fill="#2D2B55"/>
  <circle cx="36.12" cy="17"    r="2.5" fill="#2D2B55"/>
  <circle cx="36.12" cy="31"    r="2.5" fill="#2D2B55"/>
  <circle cx="24"    cy="38"    r="2.5" fill="#2D2B55"/>
  <circle cx="11.88" cy="31"    r="2.5" fill="#2D2B55"/>
  <circle cx="11.88" cy="17"    r="2.5" fill="#2D2B55"/>
  <!-- Center dot: white, r=3 -->
  <circle cx="24"    cy="24"    r="3"   fill="#FFFFFF"/>
</svg>

**Geometry:** Pointy-top hexagon at r=14, stroke-width=2, stroke-linejoin="round". Six background-filled circles at each vertex: r=2.5, fill=`#2D2B55`. Center dot: r=3, fill=`#FFFFFF`.

The knockout effect relies on painter's-algorithm layering: hexagon stroke painted first, vertex dots painted second. The dot's fill matches the outer circle's fill exactly — on this dark background, the dot reads as a hole. This is not a true SVG clip-path; it is a color-match mask. The effect holds perfectly as long as the vertex dots sit on the uniform `#2D2B55` field of the outer circle. It breaks at the outer circle's edge (the top vertex at cy=10 is r=12 from the circle edge, well inside the safe zone).

**Mark concept:** The hexagon connects six points on a ring — but at each connection point, the line stops and a node takes over. The six nodes are the participants; the line segments between them are the conversations that run between pairs. The center dot is the shared ground. This reads structurally as a graph: six vertices, six edges forming the perimeter, and the center as common reference. It is less "table" and more "network of peers" — which is accurate for a multi-model conversation interface.

**Brand positioning fit:** Strong. The knockout dots foreground the six participants as individual nodes rather than as corners of a geometric form. The hexagonal structure remains — the six positions are clearly arranged in the characteristic hexagonal pattern — but the emphasis shifts from the perimeter to the nodes. The "equal voices" reading is strengthened: the six dots are all the same size, all the same distance from center, none privileged over the others. The center dot is passive (white fill, same as the interior marks), not promoted to hub status.

**Tradeoffs:**

The critical question for this variant is 16px behavior. At 16px display size:
- The hexagon stroke at 2px width renders at approximately 0.67px per stroke arm — at the edge of sub-pixel rendering. The hexagon itself will be marginal.
- The vertex dots at r=2.5 render at approximately 0.83px radius — effectively invisible as distinct circles. They will appear as darker patches at the hexagon corners, which may read as corner degradation rather than intentional knockouts.
- Net result at 16px: the knockout effect is lost. The mark reads as an imperfect hexagon with corner erosion. This is worse than Options 2 or 7 at 16px, where the hexagon at least reads as a clean circle badge without the corner artifacts.

At 32px: the knockout effect becomes partially legible. The dots (1.67px radius) are visible as distinct shapes. The "terminated stroke" reading begins to work. This is the effective minimum size for 10a.

At 48px and above: the effect reads clearly. The hexagon stroke terminates at six distinct node circles. The form is distinctive — unlike any of Options 1–9.

The color-match technique is load-bearing: if the mark is placed on any background other than `#2D2B55`, the knockout circles become visible as `#2D2B55` filled dots on the new background, destroying the effect. This means 10a is not safely usable as a standalone mark on colored or light backgrounds — the monochrome variants (mono-light.svg, mono-dark.svg) cannot use this technique without modification. Any light-background placement would require either: (a) replacing the knockout dots with the light background color, or (b) using true SVG clip-path masking to cut the dots out of the stroke.

**Comparison to Options 2 and 7:** 10a extends Option 2's hexagon with meaningful visual information at the vertices. Where Option 2's hexagon corners are incidental (they are the artifact of connecting six straight strokes), 10a's vertex dots are intentional — they are the mark's primary semantic elements. The tradeoff is added complexity and the 16px failure mode. Option 7 (rounded joins, heavier stroke) is cleaner at all sizes; 10a is more conceptually precise.

**Verdict:** Visually strong at 48px and above. The knockout effect is distinctive and the peer-node reading is brand-appropriate. Two practical concerns: (1) 16px failure — the effect becomes corner erosion rather than intentional structure; (2) background-dependency — the color-match technique locks the mark to `#2D2B55` backgrounds, requiring separate treatment for all non-dark contexts. Not recommended as the primary mark under current identity constraints. Appropriate as a display variant for contexts with guaranteed dark backgrounds at 48px+ render size.

---

## Option 10b — Pointy-Top Hexagon with White Overlay Vertex Dots

**Options 2 + 4 combined: the hexagon stroke with six white filled dots sitting on top at each vertex**

Same hexagon, opposite treatment. The vertex dots here are white (fill=`#FFFFFF`), identical to the stroke color. They sit on top of the hexagon, merging with the stroke at each corner. The visual effect: the hexagon terminates in six rounded, slightly bulbous nodes — the corners are emphasized rather than suppressed. The dots read as glowing endpoints, each vertex a lit node.

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" width="96" height="96">
  <title>Roundtable — Option 10b: Pointy-Top Hexagon, White Overlay Vertex Dots</title>
  <circle cx="24" cy="24" r="22" fill="#2D2B55"/>
  <!--
    Pointy-top hexagon stroke: white, stroke-width=2, stroke-linejoin=round.
    Vertices at r=14, first at 90° (top).
  -->
  <polygon
    points="24,10 36.12,17 36.12,31 24,38 11.88,31 11.88,17"
    fill="none"
    stroke="#FFFFFF"
    stroke-width="2"
    stroke-linejoin="round"
  />
  <!--
    Six vertex dots: white filled, r=2.5, painted on top of the hexagon stroke.
    They merge with the white stroke at each vertex, creating a rounded bulge
    at each corner — the vertex is emphasized, not suppressed.
    Reading: six lit nodes connected by white lines.
  -->
  <circle cx="24"    cy="10"    r="2.5" fill="#FFFFFF"/>
  <circle cx="36.12" cy="17"    r="2.5" fill="#FFFFFF"/>
  <circle cx="36.12" cy="31"    r="2.5" fill="#FFFFFF"/>
  <circle cx="24"    cy="38"    r="2.5" fill="#FFFFFF"/>
  <circle cx="11.88" cy="31"    r="2.5" fill="#FFFFFF"/>
  <circle cx="11.88" cy="17"    r="2.5" fill="#FFFFFF"/>
  <!-- Center dot: white, r=3 -->
  <circle cx="24"    cy="24"    r="3"   fill="#FFFFFF"/>
</svg>

**Geometry:** Pointy-top hexagon at r=14, stroke-width=2, stroke-linejoin="round". Six white-filled circles at each vertex: r=2.5, fill=`#FFFFFF`. Center dot: r=3, fill=`#FFFFFF`. All white elements painted in one pass — the hexagon stroke, vertex dots, and center dot share the same fill value.

Unlike 10a, the 10b vertex dots can be drawn in any order relative to the hexagon stroke. Since they are the same color, there is no painter's-algorithm dependency. The dots simply add white mass at each vertex, rounding the corners of the hexagon visibly.

**Mark concept:** A hexagonal network graph with weighted nodes. The white dots at each vertex are slightly larger than the stroke width (r=2.5 vs. effective stroke radius ~1), so each vertex reads as a prominent endpoint — a seat, a participant, a model. The connecting strokes are thinner than the nodes, establishing clear visual hierarchy: nodes are primary, connections are secondary. The center dot (r=3, same white, slightly larger than the vertex dots at r=2.5) reads as the central gathering point with modest emphasis.

This is the same semantic as Option 4 (seat dots) but with the hexagonal perimeter retained as explicit structure. Option 4 had only the dots — the hexagonal arrangement was implied. 10b shows the arrangement and the connections simultaneously.

**Brand positioning fit:** Strong. The weighted-node structure communicates "participants connected in a ring" directly. The six equal white dots are six equal voices — the visual hierarchy matches the brand's equal-voice claim. The center dot is larger than the vertex dots (r=3 vs r=2.5) but its positioning — in the center, not on the perimeter — reads as the shared space, not as a privileged participant. The network-graph grammar is correct for a multi-model conversation interface: the models are the nodes, the conversation is the edge connecting them.

**Tradeoffs:**

At 16px: the white vertex dots (r=2.5) render at approximately 0.83px radius — at the edge of visibility, same as 10a. However, the failure mode here is different from 10a. Where 10a's knocked-out dots degrade to corner erosion, 10b's white overlay dots simply merge with the hexagon stroke and vanish as distinct shapes. The net result at 16px is a hexagon with slightly thicker, rounder corners — essentially identical to Option 7 (rounded joins, stroke-width=3). This is not a hard failure; it is a graceful degradation to a form that already appears in this exploration. At 16px, 10b collapses to a rounded-hexagon circle badge, same as Option 7.

At 32px: vertex dots (1.67px radius) become partially distinct from the stroke. The form reads as hexagon-with-rounded-corners rather than hexagon-with-node-dots. Partial legibility of the node concept.

At 48px: the six vertex dots read distinctly as separate elements. The node-plus-connection grammar is legible. The center dot (r=3) reads as slightly more prominent than the vertex dots (r=2.5), appropriate hierarchy.

At 96px and above: the difference between the dot radius (r=2.5) and the stroke half-width (~1px) is clearly visible. The mark has two graphic layers: the connecting lines and the endpoint nodes. The semantic is clear.

Background independence: unlike 10a, 10b is background-independent. The vertex dots are white — they do not rely on matching the background color to achieve their effect. On any dark background, the white dots are white dots. On a light background, both hexagon stroke and vertex dots would need to be recolored (as any white mark on white would), but the technique itself does not introduce additional constraints. Monochrome light and dark variants can use the same construction with color-swapped fills.

**Comparison to 10a:** The two options read as fundamentally different marks despite sharing the same geometry:
- 10a: the hexagon has holes at its vertices — the perimeter is interrupted, the stroke terminates at each node
- 10b: the hexagon has weights at its vertices — the perimeter is continuous (the dots merge with the stroke), and the corners are emphasized

10a reads as "separation at the joints." 10b reads as "emphasis at the joints." For Roundtable's brand — six equal participants in a shared conversation, all connected — 10b's emphasis reading is more coherent. The participants are not separate from the structure; they are the structure.

**Comparison to Options 2 and 7:** 10b is a refinement of Option 2 with vertex emphasis added. Against Option 7 (rounded joins, stroke-width=3), 10b differs in one important respect: Option 7's rounded joins are a stroke property — they soften the corners as a side effect of the rendering engine. 10b's vertex dots are intentional additions — they are designed elements that happen to produce a similar visual outcome at large sizes. The intent behind them is different, and at 48px+ that intent reads through.

**Verdict:** The strongest of the new options. 10b degrades gracefully at 16px (collapses to a rounded-corner hexagon badge, functionally equivalent to Option 7), is background-independent (unlike 10a), and reads clearly at 48px and above as a node-plus-connection network graph. The "six equal participants, connected in a ring" reading is more explicit than Options 2 or 7 without the complexity of Options 8 or the semantic problem of Option 9. The main open question is whether the network-graph grammar ("connected nodes") is preferred over the pure hexagonal-form grammar ("six equal vertices") — that is a brand direction call, not a visual one. If the former, 10b is the recommended mark. If the latter, Option 2 remains.

---

## Comparison Summary

| Option | Bolt reading? | 16px legibility | Brand name fit | Key risk | Departure from current |
|--------|:------------:|:---------------:|:--------------:|----------|:----------------------:|
| 1 — Flat-top hex (current) | Yes | Circle badge | Contradicts | Bolt/nut association | None |
| 2 — Pointy-top hex | No | Circle badge | Neutral | Faint gem association | Minimal (30° rotate) |
| 3b — Two concentric rings | No | Excellent | Strong | Generic / bull's-eye | Significant |
| 4 — Six seat dots | No | FAIL (sub-pixel) | Excellent | Size constraint | Major |
| 5 — Thick annular ring | No | Good | Good | Gunsight reading | Significant |
| 6 — Seat arc | No | FAIL (gap invisible) | Partial | Loading spinner | Major |
| 7 — Rounded hex (pointy-top) | No | Circle badge | Neutral | Warmth vs. precision | Minimal–Moderate |
| 8a — Rounded hex + inward seat arcs | No | FAIL (interior crowding) | Strong (concept) | All arcs converge at r=5.12; collapses | Major |
| 8b — Rounded hex + outward seat arcs | No | Circle badge | Strong | Three-system complexity; vertex node clusters | Major |
| 9a — Spokes + hex outline | No | Circle badge | Contradicts | Hub hierarchy vs. equal-voice brand claim | Major |
| 9b — Spokes only | No | Ambiguous blur | Contradicts | Hub hierarchy; starburst read; no closure | Major |
| 10a — Hex + knockout vertex dots | No | FAIL (corner erosion) | Strong | Background-dependent technique; 16px breaks to artifacts | Moderate |
| 10b — Hex + white overlay vertex dots | No | Circle badge (graceful) | Strong | Node-graph grammar may read as network, not table | Moderate |
| **R1 — Ring + seat dots (selected)** | No | Circle badge (ring visible at 32px+) | Excellent | None identified | Major |

---

## Recommendation

**Option 2 — Pointy-Top Hexagon** was the recommended direction from exploration, with **Option 7** (rounded joins) as the secondary candidate for review if a warmer mark is preferred.

**The user selected Option R1** — a synthesis not on the original numbered list. See the Decision section above for R1 geometry and rationale.

### Original rationale for Option 2 (retained for reference)

The bolt/nut reading in Option 1 is real and not minor — it is the first reading for most viewers who have not read the identity document. Marks must communicate before they are explained. The 30° rotation to pointy-top eliminates this reading entirely, at no cost to the hexagonal structure or the six-equal-vertices concept.

The objection in the current `identity.md` to pointy-top was that rotation "breaks the constructed table metaphor." On examination, this does not hold. The table metaphor lives in: (a) six equal vertices, and (b) containment within a circle. Neither changes at 30°. A hex table viewed from above at 30° of rotation is still a hex table. The flat-top orientation is not uniquely table-like; it is uniquely bolt-like.

Option 3b (thin two rings) is the correct alternative if the goal is maximum alignment with the word "Roundtable." It is cleaner, more scalable, and conceptually pure. But it sacrifices the constructed specificity of the hexagonal form — concentric rings are a generic primitive, and the brand needs something that can stand alone at favicon scale with a distinct shape, not merely a circle-within-a-circle that reads as a target.

Option 4 (seat dots) is the most narratively compelling and should be kept in consideration for future work. If the identity spec is updated to permit a simplified badge (filled circle only) at 16px — acknowledging that interior detail is not achievable at sub-20px — then a seat-dot mark at r=3.5 or r=4 becomes viable at 32px and above, with the filled circle serving as the favicon. This is worth proposing as a Phase 5 brand refinement.

Option 8b (outward seat arcs) earns an honorable mention: it is the most explicit "seat at the table" reading in this exploration, and the geometry is sound. It is not recommended as the primary direction because the complexity cost — three overlapping geometric systems — is high relative to the clarity gain over Options 2/7. If the brand ever needs to communicate the seat metaphor more overtly (print, large-format signage, contexts where explanation is available), 8b is worth revisiting.

Option 9 (spokes) is eliminated on conceptual grounds. The hub-and-spoke structure contradicts the brand's equal-voice positioning, and no visual treatment resolves that structural mismatch.

Option 10b (white overlay vertex dots) is the strongest new direction added in this pass. It degrades gracefully at 16px, is background-independent, and communicates six equal participants at the hexagon positions with greater explicitness than Options 2 or 7. If the brand direction favors the network-graph grammar ("connected nodes") over pure geometric form, 10b is worth elevating to co-candidate status alongside Option 2. Option 10a (knockout dots) is the more striking effect but is disqualified as a primary mark by its background-dependency and 16px artifact failure.

---

## Luma Handoff

No token changes required for any option examined above. The brand palette (`#2D2B55`, `#C4C2E8`, `#FFFFFF`) is unchanged across all directions. R1 was selected — Aria updates the SVG source in the React component; Marque has updated `/_design/brand/logo/` source files. No palette, token, or typeface changes required.
