/**
 * Gate — themeValidation.ts
 *
 * Implements validateCustomTheme() — validates unknown JSON against the full
 * Roundtable token schema defined in /_design/tokens/schema.md.
 *
 * Design decision: ValidationResult is defined here rather than in
 * /src/types/index.ts because it is a Gate-internal implementation detail —
 * the UI layer (Aria) consumes it only through the function return value.
 * If Arch decides to promote it to a cross-agent type, that is a separate
 * types PR; Gate does not modify /src/types/index.ts unilaterally.
 *
 * Fail-closed rule: any field that is ambiguous as to whether it is required
 * is treated as required. The validator prefers "reject valid JSON" over
 * "accept invalid JSON that silently breaks the UI."
 */

// ─── Result type ──────────────────────────────────────────────────────────────

/**
 * Result of a custom theme JSON validation attempt.
 *
 * When `valid` is true, `errors` is empty.
 * When `valid` is false, `errors` contains at least one entry, each describing
 * a specific field-level problem the UI can display inline.
 *
 * Aria should import this type from `@/auth` alongside `validateCustomTheme`.
 */
export interface ValidationResult {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if the value is a 6-digit hex color string, e.g. "#1A2B3C". */
function isHexColor(value: unknown): boolean {
  return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value);
}

/** Returns true if the value is a non-null, non-array object. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates that an object contains all required keys and that each value
 * satisfies the provided predicate. Appends errors to the accumulator.
 *
 * @param obj     - The object to inspect (or undefined/null if the parent key was missing).
 * @param section - The dot-notation section name, e.g. "surfaces".
 * @param keys    - Required key names within the section.
 * @param check   - Predicate that each value must satisfy.
 * @param label   - Human-readable description of the expected format.
 * @param errors  - Accumulator array for field-level errors.
 */
function validateSection(
  obj: unknown,
  section: string,
  keys: readonly string[],
  check: (v: unknown) => boolean,
  label: string,
  errors: Array<{ field: string; message: string }>
): void {
  if (!isObject(obj)) {
    errors.push({ field: section, message: `Missing or invalid section "${section}"` });
    return;
  }

  for (const key of keys) {
    const field = `${section}.${key}`;
    if (!(key in obj)) {
      errors.push({ field, message: `Missing required field "${field}"` });
    } else if (!check(obj[key])) {
      errors.push({ field, message: `"${field}" must be ${label}` });
    }
  }
}

// ─── Schema constants ─────────────────────────────────────────────────────────
// Values sourced from /_design/tokens/schema.md — Luma owns the schema;
// Gate owns the validation implementation against it.

const RADIUS_VALUES: Record<string, string> = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  full: '9999px',
};

const SPACING_VALUES: Record<string, string> = {
  '1': '4px',
  '2': '8px',
  '3': '12px',
  '4': '16px',
  '6': '24px',
  '8': '32px',
  '12': '48px',
  '16': '64px',
};

const TIMING_VALUES: Record<string, string> = {
  instant: '0ms',
  fast: '100ms',
  medium: '200ms',
  slow: '350ms',
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate unknown JSON against the full Roundtable token schema.
 *
 * Returns `{ valid: true, errors: [] }` when the input satisfies every rule in
 * /_design/tokens/schema.md.
 *
 * Returns `{ valid: false, errors: [...] }` with one entry per violation when
 * the input is invalid. The `field` on each error is a dot-notation path
 * (e.g. `"surfaces.background"`) that the UI can use to display inline errors
 * next to the relevant field.
 *
 * The function never throws — all errors are accumulated and returned.
 *
 * Fail-closed rule: every field documented in the schema is required.
 * Any absent or incorrectly typed field produces an error entry.
 */
export function validateCustomTheme(json: unknown): ValidationResult {
  const errors: Array<{ field: string; message: string }> = [];

  if (!isObject(json)) {
    return {
      valid: false,
      errors: [{ field: '', message: 'Theme must be a JSON object' }],
    };
  }

  // ── name ────────────────────────────────────────────────────────────────────
  if (typeof json.name !== 'string' || json.name.trim() === '') {
    errors.push({ field: 'name', message: '"name" must be a non-empty string' });
  }

  // ── mode ────────────────────────────────────────────────────────────────────
  if (json.mode !== 'dark' && json.mode !== 'light') {
    errors.push({ field: 'mode', message: '"mode" must be exactly "dark" or "light"' });
  }

  // ── surfaces ────────────────────────────────────────────────────────────────
  validateSection(
    json.surfaces,
    'surfaces',
    ['background', 'card', 'sidebar', 'input'],
    isHexColor,
    'a 6-digit hex color (e.g. "#1A2B3C")',
    errors
  );

  // ── text ────────────────────────────────────────────────────────────────────
  validateSection(
    json.text,
    'text',
    ['primary', 'secondary', 'muted', 'inverse'],
    isHexColor,
    'a 6-digit hex color',
    errors
  );

  // ── borders ─────────────────────────────────────────────────────────────────
  validateSection(
    json.borders,
    'borders',
    ['default', 'subtle', 'strong'],
    isHexColor,
    'a 6-digit hex color',
    errors
  );

  // ── accents ─────────────────────────────────────────────────────────────────
  validateSection(
    json.accents,
    'accents',
    ['model-claude', 'model-gpt', 'model-gemini', 'model-other', 'model-grok', 'model-deepseek', 'model-mistral'],
    isHexColor,
    'a 6-digit hex color',
    errors
  );

  // ── interactive ─────────────────────────────────────────────────────────────
  validateSection(
    json.interactive,
    'interactive',
    ['hover', 'active', 'focusRing'],
    isHexColor,
    'a 6-digit hex color',
    errors
  );

  // ── semantic ────────────────────────────────────────────────────────────────
  validateSection(
    json.semantic,
    'semantic',
    ['success', 'warning', 'error', 'error-bg', 'info'],
    isHexColor,
    'a 6-digit hex color',
    errors
  );

  // ── radius ──────────────────────────────────────────────────────────────────
  if (!isObject(json.radius)) {
    errors.push({ field: 'radius', message: 'Missing or invalid section "radius"' });
  } else {
    for (const [key, expected] of Object.entries(RADIUS_VALUES)) {
      const field = `radius.${key}`;
      if (!(key in json.radius)) {
        errors.push({ field, message: `Missing required field "${field}"` });
      } else if (json.radius[key] !== expected) {
        errors.push({ field, message: `"${field}" must be exactly "${expected}"` });
      }
    }
  }

  // ── spacing ─────────────────────────────────────────────────────────────────
  if (!isObject(json.spacing)) {
    errors.push({ field: 'spacing', message: 'Missing or invalid section "spacing"' });
  } else {
    for (const [key, expected] of Object.entries(SPACING_VALUES)) {
      const field = `spacing.${key}`;
      if (!(key in json.spacing)) {
        errors.push({ field, message: `Missing required field "${field}"` });
      } else if (json.spacing[key] !== expected) {
        errors.push({ field, message: `"${field}" must be exactly "${expected}"` });
      }
    }
  }

  // ── shadow ──────────────────────────────────────────────────────────────────
  if (!isObject(json.shadow)) {
    errors.push({ field: 'shadow', message: 'Missing or invalid section "shadow"' });
  } else {
    // shadow.none must be exactly "none"
    if (!('none' in json.shadow)) {
      errors.push({ field: 'shadow.none', message: 'Missing required field "shadow.none"' });
    } else if (json.shadow.none !== 'none') {
      errors.push({ field: 'shadow.none', message: '"shadow.none" must be exactly "none"' });
    }
    // shadow.sm / md / lg: any non-empty string (valid CSS box-shadow)
    for (const key of ['sm', 'md', 'lg'] as const) {
      const field = `shadow.${key}`;
      if (!(key in json.shadow)) {
        errors.push({ field, message: `Missing required field "${field}"` });
      } else if (typeof json.shadow[key] !== 'string' || (json.shadow[key] as string).trim() === '') {
        errors.push({ field, message: `"${field}" must be a non-empty CSS box-shadow string` });
      }
    }
  }

  // ── timing ──────────────────────────────────────────────────────────────────
  if (!isObject(json.timing)) {
    errors.push({ field: 'timing', message: 'Missing or invalid section "timing"' });
  } else {
    for (const [key, expected] of Object.entries(TIMING_VALUES)) {
      const field = `timing.${key}`;
      if (!(key in json.timing)) {
        errors.push({ field, message: `Missing required field "${field}"` });
      } else if (json.timing[key] !== expected) {
        errors.push({ field, message: `"${field}" must be exactly "${expected}"` });
      }
    }
  }

  // ── prose ───────────────────────────────────────────────────────────────────
  // Full prose set per schema.md. Note: CustomThemeJSON in /src/types/index.ts
  // currently declares only `link` and `link-hover`; the full prose set is
  // required by Luma's schema and is validated here. This discrepancy should be
  // resolved by Arch in a follow-up types PR — CustomThemeJSON.prose should be
  // expanded to include all 7 fields.
  validateSection(
    json.prose,
    'prose',
    ['code-bg', 'code-border', 'code-text', 'block-bg', 'link', 'link-hover', 'blockquote-border'],
    isHexColor,
    'a 6-digit hex color',
    errors
  );

  return {
    valid: errors.length === 0,
    errors,
  };
}
