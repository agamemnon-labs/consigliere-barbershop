# Design research notes (2026-11-23)

What current designers and design communities count as good and as "AI slop" UI in late 2026, and what it means for Consigliere. The skills listed here were read as reference only: they are not installed, and none of their scripts were run.

## Sources

- unslop by Damir Sokolovsky (CC BY 4.0): https://github.com/heydamir/unslop. This is Nopal's chosen checklist (`SKILL.md`, `references/signs.md`).
- taste-skill by Leonxlnx: https://github.com/Leonxlnx/taste-skill (`references/copy-tells.md`, dated November 2026).
- impeccable by Paul Bakaus: https://github.com/pbakaus/impeccable (`reference/distill.md`, `quieter.md`, `mode-operate.md`). Anti-patterns: https://www.mintlify.com/pbakaus/impeccable/concepts/anti-patterns
- Laith0003 ux-skill, "Anti AI slop ban list": https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list
- "Spot the slop: a UI designer's guide to fixing AI defaults": https://world.hey.com/kostac/spot-the-slop-a-ui-designer-s-guide-to-fixing-ai-defaults-4c448c9c
- "How to de-slopify your designs" (UX Collective): https://uxdesign.cc/how-to-de-slopify-your-designs-4c40c57c1dc9
- "AI makes bad design look good enough" (Built In): https://builtin.com/articles/ai-design-slop-era
- Wait-time UX for barbershops (Zenoti): https://www.zenoti.com/thecheckin/how-to-minimize-wait-time-frustration-at-your-salon-spa-or-barbershop. Waitwhile: https://waitwhile.com/blog/waitlist-app-for-barbershops/

## Takeaways for Consigliere

### Screens and layout

1. **One job per screen, one primary action.** Allow at most one secondary action. Everything else sits behind a tap (`<details>`) or on its own step. When a screen feels full, cut before adding (impeccable *distill*).
2. **Quiet chrome, one bright moment.** The cloakroom ticket stub (and the member card that shares its look) is our one moment and signature. Keep everything around it in neutral ramps with the oxblood accent used rarely (unslop).

### Copy

3. **Sentence-case labels.** Our UPPERCASE, widely tracked `.label` style reads as slop under unslop. Small labels become sentence case at normal tracking, with hierarchy carried by size and colour.
4. **No italic for emphasis.** The italic muted lines ("Kursi kosong", empty states) become plain muted text.
5. **No trailing periods on headlines, labels and buttons, and no exclamation marks.** "Ambil nomor." becomes "Ambil nomor". Avoid the "X. Y." two-fragment headline, a current model tell (taste-skill).
6. **No house voice.** Copy is plain Indonesian that says what happens next. There is no invented detail and no stat strip, and every number appears in the sentence it proves.

### Queue and booking UX

7. **Lead with what people came for.** Customers want their place in line and an honest estimate shown as a range. Show those first and big; details and receipts come after. Tell them when to leave home rather than only a minute count. Transparency about the wait reduces frustration more than speed (Zenoti, Waitwhile).

### Staff screens

8. **Staff screens are "operate" surfaces.** They use standard controls, dense and predictable, and the brand world enters only through type, palette and the ticket number. There are no costumes and no decorative layout (impeccable *operate*).

### Craft

9. **Spacing and type.** Spacing sits on a 4px grid with equal things at equal sizes. Weights are 400 and 500, and numbers use one tabular format.
10. **Motion.** Motion only explains something: colour or surface changes on hover, a tiny press. Nothing loops unless it is live.

These are applied in the UX polish pass after phase 7, customer phone screens first.

## UX polish pass, customer screens (2026-11-22)

- Every intro paragraph became one line. If a sentence explains a rule the screen already enforces (QRIS timeout, ticket estimate), cut it.
- Home shows the haircut price only; the rest folds behind "Harga lainnya". A nested `<details>` must rotate only its own mark: use `.row[open] > summary .row-mark`, never a descendant selector.
- No periods on headlines, labels, hints or button notes. Body sentences keep them.
- Italic is reserved for one signature spot (the ticket stub's "dengan {barber}").
- Do not print "± 0 mnt"; say what it means ("langsung duduk").

## Phase 8 checks (2026-11-23)

- Lighthouse caught `text-faint` at 3.2:1 on the night theme and 2.7:1 on paper. Faint text is still text: keep it at 4.5:1 or use it only for decoration.
- A missing favicon is a console 404 and costs Best Practices points. `src/app/icon.svg` fixes it.
- A demo ribbon must stay one line on a 390px phone: short copy, `truncate` on the text, `shrink-0` on the link.
