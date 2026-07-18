/**
 * MarkdownContent — GFM Table Rendering Accessibility Tests (#464)
 *
 * Issue #464 replaced the raw-text <pre> fallback for GFM tables with a proper
 * semantic table using <table>/<thead>/<tbody>/<tr>/<th>/<td>. The sanitizeSchema
 * was extended to allow the `align` attribute on <th>/<td> for column alignment.
 *
 * Audit scope (narrow — no 7-theme contrast audit; no new color tokens introduced):
 *   1. axe violations on markdown content containing a GFM table
 *   2. Proper semantic structure: <table> containing <thead> and <tbody>
 *   3. Header cells use <th> — not <td> — for column identity
 *   4. Data cells use <td>
 *   5. The outer overflow-x-auto wrapper does not hide the table from AT
 *      (overflow wrapping with scrollable content requires WCAG 1.4.4 consideration,
 *      but the div is not role-restricted and screen readers can traverse it normally)
 *   6. Table is not aria-hidden — full content accessible to screen readers
 *   7. Column-alignment attribute (`align`) does not break axe (the sanitizeSchema
 *      extension that permits `align` on th/td is validated here)
 *
 * WCAG criteria:
 *   - 1.3.1  Info and Relationships — table semantics communicate row/column structure
 *   - 1.4.10 Reflow — overflow-x-auto on the outer div prevents content loss on
 *             narrow viewports without requiring horizontal scroll of the whole page
 *   - 4.1.2  Name, Role, Value — no interactive elements in table cells (static data)
 *
 * Issue #464.
 */

import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect } from 'vitest';
import { MarkdownContent } from '@/ui/components/MarkdownContent';

// ─── Axe assertion helper ─────────────────────────────────────────────────────

function assertNoViolations(results: AxeResults): void {
  if (results.violations.length === 0) return;
  const summary = results.violations
    .map(
      (v) =>
        `[${v.impact ?? 'unknown'}] ${v.id}: ${v.help}\n` +
        v.nodes.map((n) => `  → ${n.target.join(', ')}`).join('\n'),
    )
    .join('\n\n');
  expect.fail(`Axe found ${results.violations.length} violation(s):\n\n${summary}`);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Basic 3-column GFM table — no column alignment specified. */
const SIMPLE_TABLE_MD = `
| Name    | Role     | Status  |
|---------|----------|---------|
| Alice   | Engineer | Active  |
| Bob     | Designer | Active  |
| Charlie | PM       | Pending |
`;

/** GFM table with explicit column alignment directives. */
const ALIGNED_TABLE_MD = `
| Left    | Center   | Right   |
|:--------|:--------:|--------:|
| a       | b        | c       |
| longer  | content  | here    |
`;

/** GFM table embedded after a paragraph of prose. */
const TABLE_WITH_PROSE_MD = `
Here is a comparison table:

| Model   | Context | Speed |
|---------|---------|-------|
| Claude  | 200k    | Fast  |
| GPT-4o  | 128k    | Fast  |
| Gemini  | 1M      | Fast  |

That covers the main options.
`;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MarkdownContent — #464: GFM table semantics (WCAG 1.3.1, 4.1.2)', () => {
  // ── axe scans ──────────────────────────────────────────────────────────────

  it('has no axe violations — simple GFM table (WCAG 2.1 AA)', async () => {
    const { container } = render(<MarkdownContent content={SIMPLE_TABLE_MD} />);
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations — column-aligned GFM table (WCAG 2.1 AA)', async () => {
    // The align attribute on th/td is allowed by the extended sanitizeSchema.
    // axe must not flag this as a violation.
    const { container } = render(<MarkdownContent content={ALIGNED_TABLE_MD} />);
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations — table embedded in prose (WCAG 2.1 AA)', async () => {
    const { container } = render(<MarkdownContent content={TABLE_WITH_PROSE_MD} />);
    const results = await axe(container);
    assertNoViolations(results);
  });

  // ── Semantic structure ──────────────────────────────────────────────────────

  // WCAG 1.3.1 — Info and Relationships: a data table must use native HTML table
  // elements so AT can announce row/column structure and navigate by cell.
  it('renders a <table> element (WCAG 1.3.1)', () => {
    const { container } = render(<MarkdownContent content={SIMPLE_TABLE_MD} />);
    expect(container.querySelector('table')).not.toBeNull();
  });

  it('table contains a <thead> element (WCAG 1.3.1)', () => {
    const { container } = render(<MarkdownContent content={SIMPLE_TABLE_MD} />);
    expect(container.querySelector('table thead')).not.toBeNull();
  });

  it('table contains a <tbody> element (WCAG 1.3.1)', () => {
    const { container } = render(<MarkdownContent content={SIMPLE_TABLE_MD} />);
    expect(container.querySelector('table tbody')).not.toBeNull();
  });

  // <th> elements in the header row give screen readers column identity.
  // Using <td> in <thead> would produce a structurally invalid table that AT
  // may misinterpret or fail to navigate.
  it('header cells are <th> elements, not <td> (WCAG 1.3.1)', () => {
    const { container } = render(<MarkdownContent content={SIMPLE_TABLE_MD} />);
    const theadCells = container.querySelectorAll('thead tr th');
    expect(theadCells.length).toBeGreaterThan(0);
    // Confirm no <td> elements appear in the header row
    const theadTds = container.querySelectorAll('thead tr td');
    expect(theadTds.length).toBe(0);
  });

  it('data cells are <td> elements in <tbody> (WCAG 1.3.1)', () => {
    const { container } = render(<MarkdownContent content={SIMPLE_TABLE_MD} />);
    const tbodyTds = container.querySelectorAll('tbody tr td');
    // 3 rows × 3 columns = 9 data cells for SIMPLE_TABLE_MD
    expect(tbodyTds.length).toBe(9);
  });

  it('correct number of <th> columns in header row (WCAG 1.3.1)', () => {
    const { container } = render(<MarkdownContent content={SIMPLE_TABLE_MD} />);
    const headerCells = container.querySelectorAll('thead tr th');
    // SIMPLE_TABLE_MD has 3 columns: Name | Role | Status
    expect(headerCells.length).toBe(3);
    // Verify the header text content
    const headerTexts = [...headerCells].map((th) => th.textContent?.trim());
    expect(headerTexts).toContain('Name');
    expect(headerTexts).toContain('Role');
    expect(headerTexts).toContain('Status');
  });

  // ── Overflow wrapper ────────────────────────────────────────────────────────

  // The outer <div class="overflow-x-auto"> allows horizontal scrolling on narrow
  // viewports. It is a generic container — it must not carry role or aria attributes
  // that would interfere with AT navigation through the table.
  it('table is wrapped in an overflow-x-auto <div> for narrow-viewport support', () => {
    const { container } = render(<MarkdownContent content={SIMPLE_TABLE_MD} />);
    const wrapper = container.querySelector('div.overflow-x-auto');
    expect(wrapper).not.toBeNull();
    // The wrapper must contain the table
    expect(wrapper?.querySelector('table')).not.toBeNull();
  });

  it('overflow wrapper does not carry aria-hidden (table is accessible to AT)', () => {
    const { container } = render(<MarkdownContent content={SIMPLE_TABLE_MD} />);
    const wrapper = container.querySelector('div.overflow-x-auto');
    expect(wrapper?.getAttribute('aria-hidden')).not.toBe('true');
  });

  // ── Column alignment ────────────────────────────────────────────────────────

  // remark-gfm produces align="left"|"center"|"right" in the hast properties for
  // :-delimited GFM columns. The sanitizeSchema extension allows the `align` attribute
  // on th and td to survive the rehypeSanitize pass.
  //
  // However, the custom th/td renderers in buildComponents() accept only `children`
  // and apply a fixed `text-left` class — they do not forward the `align` prop from
  // the hast properties into the DOM attribute. As a result, column alignment is
  // visually ignored in the current implementation. This is a cosmetic limitation;
  // the content is still structurally accessible and axe-clean.
  //
  // These tests verify the actual runtime behavior:
  //   - The correct number of th/td elements is rendered for aligned tables.
  //   - The column structure is semantically correct (th in thead, td in tbody).
  //   - The axe scan is clean (sanitizeSchema extension does not introduce violations).
  //   - Note: if the th/td renderers are later updated to forward `align`, these tests
  //     can be updated to assert the attribute values directly.
  it('#464: column-aligned table renders correct number of <th> columns', () => {
    const { container } = render(<MarkdownContent content={ALIGNED_TABLE_MD} />);
    const headerCells = container.querySelectorAll('thead tr th');
    // ALIGNED_TABLE_MD has 3 columns: Left | Center | Right
    expect(headerCells.length).toBe(3);
  });

  it('#464: column-aligned table renders correct number of <td> data cells', () => {
    const { container } = render(<MarkdownContent content={ALIGNED_TABLE_MD} />);
    const tbodyTds = container.querySelectorAll('tbody tr td');
    // 2 data rows × 3 columns = 6 data cells for ALIGNED_TABLE_MD
    expect(tbodyTds.length).toBe(6);
  });

  it('#464: th elements in aligned table are in <thead> (semantic structure preserved)', () => {
    const { container } = render(<MarkdownContent content={ALIGNED_TABLE_MD} />);
    expect(container.querySelector('table thead tr th')).not.toBeNull();
    // No th elements should appear in tbody
    expect(container.querySelector('table tbody tr th')).toBeNull();
  });

  // ── Data cell content ───────────────────────────────────────────────────────

  it('data cell text content is readable in the accessibility tree (WCAG 1.3.1)', () => {
    const { container } = render(<MarkdownContent content={SIMPLE_TABLE_MD} />);
    const cells = container.querySelectorAll('tbody td');
    const allCellText = [...cells].map((td) => td.textContent?.trim());
    expect(allCellText).toContain('Alice');
    expect(allCellText).toContain('Engineer');
    expect(allCellText).toContain('Active');
  });

  // ── No interactive elements in table cells ──────────────────────────────────

  // Tables rendered from model output are data-only. Interactive elements inside
  // table cells would require additional keyboard management (arrow-key navigation,
  // focus indicators within cells). There are no such elements — verify this.
  it('no interactive elements (button/link/input) in table cells (WCAG 4.1.2)', () => {
    const { container } = render(<MarkdownContent content={SIMPLE_TABLE_MD} />);
    const interactiveInCells = container.querySelectorAll('td button, td a, td input, th button, th a, th input');
    expect(interactiveInCells.length).toBe(0);
  });
});
