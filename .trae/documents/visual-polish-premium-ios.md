# Visual Polish — Premium iOS Grade

> Goal: elevate the app to App Store premium-productivity visual quality (Apple HIG / Linear / Flighty / Things 3 / Notion Calendar references). **Visual polish only** — layout, interaction, and business logic stay intact. The signature "card background as progress bar" feature is preserved and refined.

---

## 1. Summary

A focused visual upgrade across the theme, the two progress-bar cards, the calendar, the credits editor modal, and the loading overlay. Three official Expo modules are added (`expo-linear-gradient`, `expo-haptics`, `expo-blur`) to enable soft gradient progress fills, native tactile feedback, and a frosted modal backdrop. The Material feel of `react-native-paper` is overridden toward native iOS — cleaner inputs, softer shadows, hairline borders, refined typography with proper tracking, and more generous whitespace.

**Non-goals (out of scope):** no layout restructure, no navigation changes, no new features, no business-logic edits, no custom font bundling (system SF Pro on iOS is the target native typeface).

---

## 2. Current State Analysis

Stack (confirmed): Expo SDK `~57.0.4`, RN `0.86.0`, TypeScript, `react-native-paper ^5.15.3` (MD3), `react-native-calendars ^1.1314.0`. Single-screen app, `App.tsx` entry. Styling = plain `StyleSheet.create` with centralized tokens in `src/theme.ts`. No `expo-linear-gradient` / `expo-blur` / `expo-haptics` / `react-native-reanimated` / custom fonts installed.

Signature feature (both progress cards): an absolutely-positioned `View` of `width: ${progress*100}%`, flat `backgroundColor` at `opacity: 0.22` over a white card. Workday uses static indigo `#6366F1`; Credits uses dynamic `getCreditsColor(ratio)` (emerald/amber/red). `getCreditsDarkColor(ratio)` exists in theme.ts but is **currently unused** — a leftover that this plan wires up for the gradient end-stop.

Pain points against the premium-iOS brief:
- Material-style Paper `TextInput` (flat + underline) in the credits editor — visibly non-iOS.
- Calendar day cells use saturated Tailwind-400 solids (`#34D399`, `#F87171`, `#FBBF24`, `#A78BFA`, `#60A5FA`) — too loud for "minimal/elegant".
- Big numerals at `fontWeight:'800'` with no tracking — slightly heavy, lacks elegance.
- 1px vertical dividers between metrics — dated, divider-y.
- 16px screen padding + 16px card gaps — a touch cramped for premium breathing room.
- Indigo-tinted shadow is decent but single-layer and slightly sharp (blur 8).
- No haptics, no blur, no gradient — flat feel.

Files to touch (all confirmed to exist):
- `src/theme.ts` — tokens + helpers
- `App.tsx` — screen layout spacing
- `src/components/WorkdayProgress.tsx`
- `src/components/CreditsProgress.tsx`
- `src/components/MonthCalendar.tsx`
- `src/components/CreditsEditor.tsx`
- `src/components/CardLoading.tsx`
- `app.json` — Expo config (blur plugin + adaptive icon bg)
- `package.json` — new deps (installed via `npx expo install`)

---

## 3. Design Principles (the polish lens)

1. **Whitespace over lines.** Replace dividers with spacing wherever possible.
2. **Hairline, not borders.** 1px `rgba(15,23,42,0.06)` defines edges crisply without heaviness.
3. **Diffuse, low shadows.** Softer + larger radius, lower opacity. No "stacked cardboard" lift.
4. **Restrained color, strong type.** Muted surface tints; hierarchy from size + weight + tracking, not saturation.
5. **Native numerals.** Big numbers in `700` (not `800`) with slight negative tracking — Flighty/Things 3 feel.
6. **Tactile + frosted.** Haptics on key interactions; blur on the modal backdrop.
7. **Preserve the signature.** Background-fill progress bar stays; refined to a subtle 2-stop gradient with a hard clipped right edge.

---

## 4. New Dependencies

Install with `npx expo install expo-linear-gradient expo-blur expo-haptics` (pinned to SDK 57 by the installer). Register the blur plugin in `app.json` (Expo handles it; no manual native edits beyond prebuild). These are official Expo modules — no sketchy deps.

---

## 5. Proposed Changes — by file

### 5.1 `src/theme.ts` — refined tokens & helpers

**What:** Refined palette + new tint tokens + a `withAlpha()` helper for gradient stops. Wire in the existing (unused) `getCreditsDarkColor`.

**Why:** Central source of truth; every component pulls from here. Muted calendar tints and hairline tokens must live here.

Concrete new/changed tokens:

```ts
// Surfaces — slightly cooler/softer app bg
background: '#F4F5F7',          // was #F1F5F9
surface: '#FFFFFF',
surfaceVariant: '#F6F7F9',
hairline: 'rgba(15, 23, 42, 0.06)',   // NEW — crisp 1px edge
hairlineStrong: 'rgba(15, 23, 42, 0.10)', // NEW — focus/pressed

// Text — stronger hierarchy
textPrimary: '#0F172A',         // was #1E293B (Slate-800 → Slate-900)
textSecondary: '#475569',       // was #64748B (Slate-500 → Slate-600, more readable)
textMuted: '#94A3B8',           // unchanged

divider: 'rgba(15, 23, 42, 0.06)',  // was #E2E8F0

// Calendar — accent colors (600-level, for day NUMBER text) stay
// NEW: tint variants (Tailwind-50-level) for day-cell BACKGROUNDS
workdayTint: '#ECFDF5',         // Emerald 50  (was solid #34D399 bg)
holidayTint: '#FEF2F2',         // Red 50      (was #F87171)
adjustedWorkdayTint: '#FFFBEB', // Amber 50    (was #FBBF24)
overtimeTint: '#F5F3FF',        // Violet 50   (was #A78BFA)
leaveTint: '#EFF6FF',           // Blue 50     (was #60A5FA)
weekendTint: '#F1F5F9',         // Slate 100

// 600-level text variants for day numbers (NEW for readable contrast on tints)
workdayText: '#059669',         // Emerald 600
holidayText: '#DC2626',         // Red 600
adjustedWorkdayText: '#D97706',// Amber 600
overtimeText: '#7C3AED',        // Violet 600
leaveText: '#2563EB',           // Blue 600
weekendText: '#64748B',         // Slate 500
```

New helper (for gradient stops):
```ts
// hex (#RRGGBB) -> 'rgba(r,g,b,a)'
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
```

`getCreditsColor` / `getCreditsDarkColor` — unchanged signatures; `getCreditsDarkColor` finally gets used (CreditsProgress gradient). `paperTheme` — keep, refresh `onSurface`/`onSurfaceVariant` to match new text tokens.

### 5.2 `App.tsx` — breathing room

**What:** Increase screen padding and inter-card spacing. Change only `styles`.
**Why:** Premium apps breathe. 16→20 padding, 16→18 card gap.

```ts
scroll: {
  padding: 20,        // was 16
  paddingTop: 20,
},
bottomSpacer: { height: 28 },  // was 32 (slightly tighter bottom)
```
No other edits to `App.tsx`.

### 5.3 `src/components/WorkdayProgress.tsx` & `CreditsProgress.tsx` — the signature, refined

**What (both cards):**
1. Replace the flat `progressFill` `View` with an `expo-linear-gradient` `LinearGradient` — 2-stop horizontal gradient, hard right edge preserved by the card's `overflow:'hidden'` + width clip.
2. Add a 1px hairline border to the card for crisp edge definition.
3. Refine shadow: softer, more diffuse (opacity 0.05, radius 14, y 4).
4. Remove the 1px vertical metric dividers → replace with `gap` spacing only.
5. Big numerals: `fontSize: 30, fontWeight: '700', letterSpacing: -0.5` (was 28/800/no tracking). More elegant.
6. Metric labels: `fontSize: 11, letterSpacing: 0.3, color: textMuted` (was 12/textSecondary).
7. Icon → wrapped in a 28×28 tinted square (`accent@12%` bg, radius 8) — premium "tinted icon chip" pattern (Things 3 / Linear).
8. Card radius 16 → 20. Card padding 16 → 20 (Credits already had asymmetric padding → unify to 20).
9. Card `marginBottom` 16 → 18.

**Workday fill gradient:**
```tsx
<LinearGradient
  colors={[withAlpha(themeColors.primary, 0.22), withAlpha(themeColors.primaryLight, 0.10)]}
  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
  style={[styles.progressFill, { width: `${progress * 100}%` }]}
/>
```

**Credits fill gradient** (wires in the previously-unused `getCreditsDarkColor`):
```tsx
const color = getCreditsColor(ratio);
const colorDark = getCreditsDarkColor(ratio);
// ...
<LinearGradient
  colors={[withAlpha(color, 0.24), withAlpha(colorDark, 0.12)]}
  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
  style={[styles.progressFill, { width: `${progress * 100}%` }]}
/>
```
The hard vertical edge at `progress%` is preserved because the LinearGradient's container View is clipped to that width by the card's `overflow:'hidden'`. **This is the signature feature, refined — not removed.**

**Credits over-budget badge:** refine radius 12 → 999 (full pill), add subtle border `hairline`, gap 5, padding `8/4`. Keep red bg + white text. Add a subtle `expo-haptics` `selection()` when it appears? No — haptics only on user actions, not on state changes.

**Tinted icon chip** (shared style, used in both cards):
```ts
iconChip: {
  width: 28, height: 28, borderRadius: 8,
  alignItems: 'center', justifyContent: 'center',
  // backgroundColor set inline to withAlpha(accent, 0.12)
},
```

### 5.4 `src/components/MonthCalendar.tsx` — muted tints + refined type

**What:**
1. Day-cell backgrounds: swap saturated 400-level solids for the new `*Tint` 50-level tokens. Day-number text color: the new 600-level `*Text` tokens (readable on the pale tints). Weekend: `weekendTint` bg + `weekendText`. This is the user-selected "muted soft tints" treatment.
2. Today highlight: refine ring — `borderWidth: 2` (was 2.5), `borderColor: themeColors.today`, keep cell's own tint bg, text in `primaryDark` weight 700. Slightly softer.
3. Wrapper card: radius 16 → 20, add hairline border, refine shadow (same softening as progress cards), padding 8 → 12.
4. Month title typography: `textMonthFontSize: 18` (was 17), keep weight 700, add letterSpacing via theme (if supported) — `react-native-calendars` theme supports font size/weight only; leave tracking to default.
5. Day-header text: `textDayHeaderFontSize: 12` (was 13), fontWeight 600, color `textMuted` (was textPrimary) — quieter, lets day numbers lead.
6. Day number default text: weight 500 → 600 for crispness on tints.
7. Legend chips: refine — dot 8×8 (was 9), radius 4, chip padding `8/4` (was 9/5), bg `surfaceVariant`, text `textMuted` fontSize 11 (was 12), letterSpacing 0.2. Tighter, quieter.
8. Edit IconButton: keep, but ensure tap target ≥ 44 (Paper IconButton default is fine).

`markedDates` mapping becomes:
```ts
case DayType.Workday:    bgColor = themeColors.workdayTint;        textColor = themeColors.workdayText;        break;
case DayType.Holiday:    bgColor = themeColors.holidayTint;        textColor = themeColors.holidayText;       break;
case DayType.AdjustedWorkday: bgColor = themeColors.adjustedWorkdayTint; textColor = themeColors.adjustedWorkdayText; break;
case DayType.Overtime:   bgColor = themeColors.overtimeTint;       textColor = themeColors.overtimeText;      break;
case DayType.Leave:      bgColor = themeColors.leaveTint;          textColor = themeColors.leaveText;         break;
case DayType.Weekend:    bgColor = themeColors.weekendTint;       textColor = themeColors.weekendText;      break;
```

### 5.5 `src/components/CreditsEditor.tsx` — de-Materialize the modal

**What:**
1. **Blur backdrop**: wrap the modal content in `expo-blur`'s `BlurView` (intensity ~40, tint `light`) as the modal's own background, OR set the `Modal` `contentContainerStyle` to a transparent backdrop and put a `BlurView` behind the card. Concretely: replace `styles.modal`'s opaque bg with a `BlurView` so the app behind frosts through (native iOS sheet feel).
2. **Inputs**: remove Paper `TextInput` underline look. Switch `mode="flat"` with `underlineColor="transparent"` and wrap each input in a `View` with `borderWidth:1, borderColor: hairline, borderRadius: 12, paddingHorizontal: 14, backgroundColor: surfaceVariant`. On focus, swap border to `themeColors.primary` (track focus via `onFocus`/`onBlur` state). This reads as a clean iOS input, not Material.
3. Modal card radius 20 → 22. Shadow soften as above.
4. Buttons: Save button radius 10 → 12, add subtle `elevation: 0` (flat, not raised). Cancel stays outlined but with `borderColor: hairlineStrong`, radius 12. Both buttons get `expo-haptics` `impact(Haptics.ImpactFeedbackStyle.Light)` on press.
5. Header icon: same tinted-chip treatment as the cards (28×28, accent 12%, radius 8).
6. Title: weight 700, letterSpacing -0.2, color textPrimary.
7. Add `expo-haptics` `selection()` on Save (success) — actually only on press, not on completion, to keep it simple: Light impact on Save press + Light impact on Cancel press.

**Why:** the editor is the most visibly "Material" surface (underlined inputs, MD3 modal). This is where de-Materialization pays off most.

### 5.6 `src/components/CardLoading.tsx` — frosted overlay

**What:** Replace the flat `rgba(255,255,255,0.75)` overlay with `expo-blur`'s `BlurView` (intensity ~25, tint `light`, reduced transparency) so the card frosts subtly while loading. Keep the `Animated` fade (opacity over the BlurView). `ActivityIndicator` color stays `themeColors.primary`.
**Why:** a frosted loading state reads as premium (Apple's native loading).

### 5.7 `app.json` — plugin + icon bg

**What:**
1. Add `"expo-blur"` to `plugins` array (so the prebuild includes the blur native module). `expo-linear-gradient` and `expo-haptics` auto-link; blur benefits from the plugin entry.
2. Update adaptive icon background color `#EEF2FF` → `#F4F5F7` (match the new app background) for icon-to-launch continuity. (Small detail; skip if it risks touching Android native assets.)

### 5.8 Haptics wiring (cross-cutting)

Add a tiny `src/haptics.ts` helper (or inline at call sites — preference: inline to avoid a new file). Use `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` at:
- Credits card edit (pencil) button press
- Calendar edit toggle (pencil/save)
- Calendar day press in edit mode (use `Selection` style — it's a toggle)
- Editor Save button (Light) + Cancel button (Light)

Keep haptics subtle; do not add to month-change arrows (too noisy).

---

## 6. Assumptions & Decisions

- **Keep `react-native-paper`** as plumbing (PaperProvider, Portal, Card wrapper, Text, IconButton, Button, TextInput). Override visuals to de-Materialize rather than rip it out — replacing Paper is a refactor beyond "polish" and risks business logic.
- **No custom fonts.** System SF Pro on iOS is exactly the native iOS typeface we want; bundling fonts adds weight for no gain on iOS. Rely on `fontWeight` + `letterSpacing` for refinement. (Android falls back to Roboto — acceptable.)
- **Preserve the background-fill progress bar** as the sole progress indicator (no top-edge hairline bar, no separate bar component) — per user's hard constraint.
- **The unused `getCreditsDarkColor` is finally wired in** as the gradient end-stop — gives a subtle hue-depth to the Credits fill and uses existing code.
- **Hard right edge of the progress fill is preserved** by clipping the gradient View to `width: progress%` inside `overflow:'hidden'` cards. The gradient adds depth *within* the filled region; it does not blur the progress boundary.
- **Calendar cell size stays 32×32** (changing it risks `react-native-calendars` layout clipping); only colors/typography change.
- **`WorkdayProgress.monthTitle` prop is still not surfaced** (currently unused). Adding it would be a layout change beyond pure polish — left untouched to stay surgical.
- **Haptics only on user-initiated presses**, never on state/data changes (no haptic when the over-budget badge appears).
- **AGENTS.md "Expo HAS CHANGED"** — verified against Expo SDK 57 docs path; `expo-linear-gradient`, `expo-blur`, `expo-haptics` are all present and supported on SDK 57. `npx expo install` will pin compatible versions automatically.

---

## 7. Verification Steps

After implementation:

1. **Visual smoke test (manual):**
   - App launches, single screen, three cards stacked. Confirm: 20px screen padding, 18px gaps, cards radius 20, hairline edges visible.
   - Workday card: indigo gradient fill (soft, hard right edge at progress%), numerals 30/700 with tight tracking, no vertical dividers between metrics, tinted icon chip top-left.
   - Credits card: dynamic green/amber/red gradient fill, same numeral/icon treatment, over-budget red pill badge when ratio>1.
   - Calendar: pale tint day cells (Emerald-50/Red-50/Amber-50/Violet-50/Blue-50/Slate-100), 600-level numbers, today ring 2px indigo. Month title 18/700. Legend chips quiet.
   - Credits editor: blurred frosted backdrop, bordered iOS-style inputs with focus state, no underlines. Save/Cancel pill buttons radius 12.
   - CardLoading: frosted blur overlay during month switch.

2. **Interaction test:**
   - Tap credits edit pencil → haptic + modal opens with blur.
   - Focus each input → border turns indigo.
   - Tap Save → haptic, modal closes, credits card updates, fill recolors if ratio crosses 0.7 / 1.0 thresholds.
   - Tap calendar edit pencil → haptic → tap a workday → becomes Leave (violet tint) with selection haptic; tap again → cycles back.
   - Switch months → loading frost appears, new month renders.

3. **Regressions (must not break):**
   - Month navigation still calls `onMonthChange` correctly.
   - `getCreditsColor` / `getCreditsDarkColor` thresholds unchanged (0.7 and 1.0).
   - Over-budget math (`Math.min(ratio,1)` width cap) intact — fill never overflows card.
   - DB persistence (save credits, toggle day types) unaffected.
   - Android widget refresh on app foreground (`NativeModules.WidgetRefreshModule`) unaffected.
   - No TypeScript errors; `npx expo prebuild`/run works on iOS.

4. **Type check + build:** `npx tsc --noEmit` passes; app runs via `npx expo run:ios` (or Expo Go) without native-module errors.

---

## 8. Implementation Order (suggested, for the executor)

1. Install deps: `npx expo install expo-linear-gradient expo-blur expo-haptics`; update `app.json` plugins.
2. Rewrite `src/theme.ts` tokens + add `withAlpha` helper.
3. Update `App.tsx` spacing.
4. Refine `WorkdayProgress.tsx` (gradient + icon chip + numerals + remove dividers + hairline + shadow).
5. Refine `CreditsProgress.tsx` (same + wire `getCreditsDarkColor` + badge pill).
6. Refine `MonthCalendar.tsx` (tints + ring + type + legend + wrapper).
7. Refine `CreditsEditor.tsx` (blur backdrop + bordered inputs + haptics + buttons).
8. Refine `CardLoading.tsx` (BlurView).
9. Add haptics at the four call sites (edit pencil, calendar toggle, day press, save/cancel).
10. Run verification steps above.
