# Consigliere brand assets

The mark is **Sisir C**: a C that is also a comb. The round back of the C is the comb's spine, its two arms are the thick outer teeth, and five fine teeth sit inside. It replaced the red-white-blue barber pole on 2026-11-27, because the pole belongs to every barbershop and the C belongs only to Consigliere.

Hand-drawn vector on a 120-unit grid (ink box 88 x 96), one path, no fonts needed. The name is Alfa Slab One and the place line is Archivo SemiBold at 125% width, both outlined so the files open anywhere.

## Files

| File                                             | Use                                                                                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `consigliere-tanda.svg`                          | The mark, suit green. Default.                                                                                                   |
| `consigliere-tanda-krem.svg`                     | The mark, cream, for suit green or photos.                                                                                       |
| `consigliere-tanda-hitam.svg`                    | The mark, espresso, for one-colour print (stamps, receipts).                                                                     |
| `consigliere-logo.svg`                           | Mark + name + "Barbershop Samarinda", side by side.                                                                              |
| `consigliere-logo-tumpuk.svg`                    | Same, stacked and centred (signage, stickers).                                                                                   |
| `consigliere-logo-krem.svg`                      | Side by side, cream, for suit green.                                                                                             |
| `consigliere-avatar-640.png`, `-512.png`, `.svg` | Profile photo for the Telegram bot, WhatsApp and social. Square, full bleed; the mark sits inside the circle those apps crop to. |

The site's own copies: `src/components/mark.tsx` (inline, takes the text colour), `src/app/icon.svg`, `favicon.ico`, `apple-icon.png`, `opengraph-image.png` and `public/icons/` (home-screen icons, `manifest.ts`).

## Colours

| Name       | Hex       | Role                                               |
| ---------- | --------- | -------------------------------------------------- |
| Suit green | `#1F3A2E` | The mark and the name. Avatar and app-icon ground. |
| Cream      | `#F4EBDC` | The page. The mark on suit green.                  |
| Espresso   | `#2B1F17` | One-colour print.                                  |
| Muted      | `#5F5045` | The place line under the name.                     |

No red anywhere in the brand: red means danger and errors in the app.

## Use

- Clear space around the mark: at least the width of the C's back (a quarter of its height).
- Smallest size: 16 px for the mark alone, 24 px tall for the side-by-side logo.
- Keep it one colour. No outlines, gradients, shadows, rotation, stretching or a different font for the name.
- On a photo, use the cream version on a calm, dark area.
