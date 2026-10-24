# Font size control

Settings offers **three independent font size sliders**, not one global zoom. Each slider has the same four tiers (Small 90%, Medium 100%, Large 115%, Extra large 130%) and applies immediately.

| Slider | CSS variable | Applies to |
| --- | --- | --- |
| Buttons | `--font-scale-button` | Text on clickable controls: `.button`, `.icon-button`, all `.text-button` variants, `.move-rule`, the step navigation (`.step`, `.step-hint`, `.step-number`), and text inside option buttons (`.example-option strong/small/.arrow`, `.alternative strong/.score/small`). |
| Titles | `--font-scale-title` | Heading-like text, whether or not it is a real heading element: `h1`–`h3` and their variants (`.ranking-header h2`, `.calendar-heading h2`, `.dialog-heading h2`, `.no-results h2`, `.panel-title h2`, `.how-panel h3`, `.source-panel h3`, `.preference-panel h3`), plus `.brand`, `.preview-title`, `.preview-subtitle`, `.benefit strong`, and disclosure summaries (`.plan-details > summary`, `.meeting-list summary`). |
| Other text | `--font-scale-other` | Everything else: labels, inputs, textareas, help text, notices, pills, calendar events, source text, footer and dialog body copy. |

## How it works

The root font size is a **fixed 15px**. Every type rule is written as a `rem` value multiplied by one of the three variables, for example:

```css
h2 { font-size: calc(1.333rem * var(--font-scale-title)); }
.button { font-size: calc(0.867rem * var(--font-scale-button)); }
h1 { font-size: clamp(calc(2rem * var(--font-scale-title)), 3.1vw, calc(2.933rem * var(--font-scale-title))); }
```

Because scaling lives in the variable rather than in the root size, the three groups move independently and layout metrics (padding, gaps, widths, control heights) stay untouched. The print sheet is deliberately excluded: it keeps its fixed `11px` root and `26px` title so printing stays compact regardless of the on-screen setting.

Choices persist in `localStorage` under `coursefit.fontSize` as `{"button":"medium","title":"large","other":"medium"}`. A value saved by the earlier single-slider version (`coursefit.fontScale`) is migrated into all three groups on first load.

## Adding or changing a type rule

1. Convert the size to `rem` against the 15px baseline (`20px` becomes `1.333rem`).
2. Multiply it by the variable for its group: `calc(<value>rem * var(--font-scale-<group>))`.
3. Never write a bare `px` or bare `rem` font size — it will not respond to any slider. This includes inline `style` attributes in `app.js`.
4. Leave `:root` and the `@media print` block at their fixed pixel sizes.

Grouping decisions worth knowing, since they are judgement calls rather than mechanical rules:

- The step navigation is a `<button>`, so all of its text follows Buttons even though it contains a title and a hint.
- Text inside option buttons (`.alternative`, `.example-option`) follows Buttons so a single control never mixes two scales.
- `.rule-summary` is descriptive text, not a `<summary>` heading, so it belongs to Other text despite its name.
- Sub-headings that are not `h1`–`h3` (`.preview-subtitle`, `.benefit strong`, disclosure summaries) count as Titles.
