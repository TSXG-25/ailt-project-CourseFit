# CourseFit interface direction

CourseFit is a semester planning workspace. The central visual is the weekly grid students are already trying to assemble. Input leads directly to a timetable, with one optional batch of questions when needed. No marketing pages or artificial usage metrics.

- Palette: ink `#202842`, paper `#FFFFFF`, cloud `#F5F7FB`, blue `#3658D4`, lavender `#EBE9FC`, green `#1B7356`. Course colors also carry code and section text, so color never conveys identity alone.
- Typography: locally available Avenir Next, falling back to system sans-serif. No font requests or dependency on external assets.
- Layout: compact top navigation and a three-step progress indicator, with the middle stage skipped for complete input. Questions use one focused column. Results give the weekly grid the majority of the width, with ranked choices beside it and a natural-language adjustment box above.
- Character: the product mark is a small calendar with fitted course blocks. A precise, quiet interface leaves color for courses and status. Flat surfaces, restrained borders, rounded controls, no ornamental gradients.
- Interaction: ask at most five consolidated questions once; answers generate directly. No confirmation checkbox or required second review. Keep interpreted courses/source available in collapsed details and show every preference's exact result. Let students fine-tune directly from successful, infeasible and incomplete-data results.
- Accessibility: visible focus, native form labels and dialog behavior, live status/errors, reduced-motion support, 44px touch targets, and a scrollable calendar plus a text meeting list on narrow screens.
- Font size: three independent sliders in Settings (**Buttons**, **Titles**, **Other text**), so students can enlarge control labels without inflating headings, or the reverse. See [Font size control](font-size-control.md).

The UI/UX search suggested a product-demo landing pattern. This was rejected because the proposal calls for a working local application; the workspace opens directly into course input instead.
