# UI / UX audit

Scope reviewed: chat experience, message bubbles, lesson player, stage renderer, controls, CSS design tokens, state handling, and UI behavior across mobile and desktop widths.

## 1) Structure

### /chat component tree
```text
src/routes/chat.tsx
└── ChatPage (src/components/chat/ChatPage.tsx)
    ├── header (brand + chat label)
    ├── ConversationThread (src/components/chat/ConversationThread.tsx)
    │   └── ChatMessage (src/components/chat/ChatMessage.tsx)
    │       ├── user bubble
    │       ├── AI bubble
    │       │   ├── loading state
    │       │   ├── error state
    │       │   ├── AnswerBlock
    │       │   │   ├── MarkdownAnswer
    │       │   │   ├── "Show illustration" CTA
    │       │   │   └── LessonPlayer (src/components/lesson/LessonPlayer.tsx)
    │       │   └── lesson error retry
    │       └── onExplainVisually -> useChat.explainVisually
    └── ChatComposer (src/components/chat/ChatComposer.tsx)
        ├── AttachmentChips / AttachMenu (src/components/site/AttachMenu.tsx)
        ├── input
        └── submit button
```

### LessonPlayer component tree
```text
src/components/engine/LessonPlayer.tsx
├── useLessonPlayback (src/components/engine/useLessonPlayback.ts)
├── LessonEngine (src/components/engine/LessonEngine.tsx)
│   ├── scene image layer
│   ├── scene object layer
│   ├── scene annotation layer
│   └── awaiting-user continue CTA
├── LessonControls (src/components/engine/LessonControls.tsx)
│   ├── restart / restart scene / rewind / play / fast forward / next
│   ├── mute toggle
│   ├── speed selector
│   ├── bookmark
│   ├── fullscreen
│   └── download
├── Timeline (src/components/engine/Timeline.tsx)
│   ├── progress bar
│   ├── scene markers
│   └── time label
├── side / bottom tabbed panel switcher
│   ├── ExplainFurtherPanel (src/components/engine/ExplainFurtherPanel.tsx)
│   ├── QuizPanel (src/components/engine/QuizPanel.tsx)
│   ├── PracticePanel (src/components/engine/PracticePanel.tsx)
│   ├── TranscriptPanel (src/components/engine/TranscriptPanel.tsx)
│   └── NotesPanel (src/components/engine/NotesPanel.tsx)
└── stage layout and CSS in src/styles.css
```

There are effectively two lesson renderers in the codebase:
- [src/components/engine/LessonPlayer.tsx](../src/components/engine/LessonPlayer.tsx) is the main engine-style player used in the app shell.
- [src/components/lesson/LessonPlayer.tsx](../src/components/lesson/LessonPlayer.tsx) is a self-contained board/player used inside AI chat responses.

## 2) What already works well (keep these)

- Strong separation of concerns: route composition in [src/routes/chat.tsx](../src/routes/chat.tsx) and state in [src/hooks/useChat.ts](../src/hooks/useChat.ts) keeps the chat flow predictable.
- The empty-chat state, loading spinners, and retry affordances are clear and fast to understand in [src/components/chat/ConversationThread.tsx](../src/components/chat/ConversationThread.tsx) and [src/components/chat/ChatMessage.tsx](../src/components/chat/ChatMessage.tsx).
- The lesson player has good keyboard support and fullscreen behavior in [src/components/engine/LessonPlayer.tsx](../src/components/engine/LessonPlayer.tsx): speed controls, keyboard shortcuts, and reduced-motion handling are thoughtful.
- Touch and tap targets are generally at least 44px in the engine controls, and the CSS intentionally enforces 44px minimum buttons in [src/styles.css](../src/styles.css) lines 317-326 and 351-365.
- The lesson engine has a real progress timeline, scene markers, and auto-hide control overlays, which makes the player feel polished at medium and large sizes.
- The design system is cohesive and intentional: the paper/ink color system and serif/sans pairing in [src/styles.css](../src/styles.css) give the app a recognizable visual identity.
- The app includes explicit reduced-motion support in [src/styles.css](../src/styles.css) lines 675-682, which is a good accessibility choice.

## 3) Problems

### P0 — breaks usability

- [src/components/chat/ChatMessage.tsx:30-35](../src/components/chat/ChatMessage.tsx) and [src/styles.css:283-354](../src/styles.css) — At 320–390px, the message bubble and lesson embed intentionally stretch with `max-sm:-mx-4` and `w-[calc(100%+2rem)]`, which creates horizontal edge bleed and cramped content; fix: remove the negative margins and use container-safe max-width with `overflow-hidden` and responsive min-width rules.
- [src/components/lesson/LessonPlayer.tsx:146-228](../src/components/lesson/LessonPlayer.tsx) and [src/styles.css:283-446](../src/styles.css) — The board uses a fixed internal width of 800 and a `stageScale` calculation, so the stage can become over-compressed or clipped at 320/375/390/430px; fix: size the board from container width rather than a hard-coded 800px stage.
- [src/components/engine/LessonPlayer.tsx:165-220](../src/components/engine/LessonPlayer.tsx) and [src/styles.css:413-447](../src/styles.css) — The panel launcher and mobile speed menu are built as fixed overlays and `details` popovers without a visible/inclusive close state, making it easy to miss or accidentally dismiss actions on touch devices; fix: replace the overlay popover with a bottom sheet or explicit modal with proper focus trap and close controls.
- [src/components/chat/ChatComposer.tsx:5-26](../src/components/chat/ChatComposer.tsx) and [src/components/site/AttachMenu.tsx:72-149](../src/components/site/AttachMenu.tsx) — The composer relies on a placeholder instead of a label, and the attach menu uses several hidden native inputs with no programmatic accessible name; fix: add visible labels/aria-labels and expose proper accessible names to all inputs and buttons.
- [src/components/engine/LessonPlayer.tsx:67-96](../src/components/engine/LessonPlayer.tsx) and [src/styles.css:273-291](../src/styles.css) — Focus styles exist only for a few classes, not for the entire player, so keyboard users can lose context when tabbing through the board, controls, and panel tabs; fix: add a consistent `:focus-visible` style to every interactive element and the entire lesson stage region.

### P1 — significant issues

- [src/components/lesson/LessonPlayer.tsx:18-23](../src/components/lesson/LessonPlayer.tsx), [src/components/lesson/LessonPlayer.tsx:239-265](../src/components/lesson/LessonPlayer.tsx) — Stage rendering is chosen by `scene.actions` and `graphActions`, not by scene type; unsupported actions are filtered into `implementedActions` and logged only with `console.warn`, so visual fidelity silently varies by lesson content; fix: choose stage mode from explicit scene metadata and fail closed with a safe fallback instead of action-name heuristics.
- [src/components/lesson/LessonPlayer.tsx:239-265](../src/components/lesson/LessonPlayer.tsx) — Unsupported actions are skipped without a visible fallback message; if a lesson contains actions like `flowNode`, `timeline`, or others outside the set, the user gets an incomplete or confusing stage; fix: show a visible unsupported-action placeholder or degrade gracefully with explanatory text.
- [src/components/engine/useLessonPlayback.ts:68-167](../src/components/engine/useLessonPlayback.ts) and [src/components/engine/LessonPlayer.tsx:986-1045](../src/components/engine/LessonPlayer.tsx) — Playback state tracking uses repeated timers and a per-frame animation loop, and those effects re-run when scene index changes, which is a known re-render hotspot during active playback; fix: throttle playback state updates to a single clock source and memoize scene calculations.
- [src/components/engine/Timeline.tsx:9-51](../src/components/engine/Timeline.tsx) — The timeline dots and progress row are tightly packed and the text is truncated to 72px, which makes them difficult to read on narrow screens and gives poor affordance for scene names; fix: switch the scene chips to a scrollable but padded list with larger hit areas and explicit labels.
- [src/components/engine/LessonControls.tsx:117-192](../src/components/engine/LessonControls.tsx) and [src/styles.css:310-354](../src/styles.css) — Control layout is intentionally compact and uses many custom 44px buttons plus inline text, but the combination of speed menu, bookmarks, fullscreen, and download can become visually dense at tablet widths; fix: stack controls by priority on mid-sized screens and reduce duplicate affordances.
- [src/components/chat/ChatMessage.tsx:42-57](../src/components/chat/ChatMessage.tsx) and [src/components/chat/ChatMessage.tsx:146-166](../src/components/chat/ChatMessage.tsx) — Loading, error, and lesson states are shown in a very terse way and the lesson CTA is not visibly distinct from the prose; fix: add explicit empty/loading/error/complete banner patterns with stronger visual hierarchy.
- [src/styles.css:209-244](../src/styles.css), [src/styles.css:265-354](../src/styles.css), and [src/styles.css:520-670](../src/styles.css) — There is a large number of hard-coded pixel values and repeated radii/spacing values (`0.4rem`, `0.5rem`, `0.6rem`, `0.75rem`, `999px`, `44px`, `32px`, etc.) without a single spacing scale; fix: define a tokenized spacing/radius scale and replace repeated ad hoc values with semantic tokens.
- [src/components/engine/LessonPlayer.tsx:74-96](../src/components/engine/LessonPlayer.tsx) and [src/components/engine/LessonPlayer.tsx:1037-1060](../src/components/engine/LessonPlayer.tsx) — Speech synthesis continues for the current narration once the player becomes non-visible, and there is no explicit pause state handoff for screen readers; fix: cancel speech when the player is hidden and provide an announcer-friendly pause/continue state.

### P2 — polish issues

- [src/styles.css:1-116](../src/styles.css) — The token system is coherent, but the actual usage is inconsistent: the app mixes raw Tailwind utility classes, CSS variables, inline hex values, and ad hoc values across the same screens; fix: centralize all typography, spacing, and color primitives into a single design-tokens layer.
- [src/components/engine/LessonPlayer.tsx:118-156](../src/components/engine/LessonPlayer.tsx) — The lesson-complete state only reveals a CTA and generic quiz/practice buttons without a clear completion banner, summary, or “what next” guidance; fix: add a dedicated lesson-complete card with a summary and next actions.
- [src/components/engine/ExplainFurtherPanel.tsx:24-88](../src/components/engine/ExplainFurtherPanel.tsx) — Suggested follow-up pills are good onboarding, but there is no empty/loading/expanded state distinction beyond the basic `Thinking…` message, making the chat feel less deliberate on small displays; fix: add a compact state stack and directional hints for the panel.
- [src/components/site/AttachMenu.tsx:109-149](../src/components/site/AttachMenu.tsx) — The menu has a nice visual pattern, but the click-outside overlay and menu layering are not robust on small screens and can conflict with the chat composer; fix: anchor the menu relative to the composer and ensure a consistent z-index and viewport-safe placement.
- [src/components/engine/LessonEngine.tsx:18-104](../src/components/engine/LessonEngine.tsx) — The animated CSS in the scene renderer is defined inline for each component, which makes it harder to reason about performance and reuse; fix: move the animation tokens into a shared stylesheet and reuse them with semantic classes.

## 4) Layout / responsiveness audit by width

Observed issues at the target breakpoints:

- 320px: chat composer can feel cramped, bubble padding is heavy, and stage controls crowd the bottom; the `Timeline` scene names are visually tiny and the lesson board becomes narrow.
- 375px: message bubble area is still valid but the lesson player adds overflow risk because the board is width-limited and the control overlay has no explicit safe-column layout.
- 390px: the `max-sm` negative margin on AI bubbles is still a visible edge condition; the stage remains narrow while the transcript and panel controls stack awkwardly.
- 430px: the button cluster becomes dense; the inline speed and bookmark/fullscreen actions begin to compete for horizontal space.
- 768px: the engine player is functional but the side panel action strip and timeline still feel crowded; the content can become visually “fuzzy” because of repeated small sizes and similar colors.
- 1280px: the layout is mostly stable, but the wide stage and the full side panel still feel visually heavy because the typography system and radius scale are varied rather than intentionally constrained.

## 5) Design system inventory

Raw counts from the repo scan:
- Distinct font-size-like values found: 44 unique values.
- Distinct color-like values found: 1,382 raw matches (high because of generated CSS, long Tailwind class output, and inline style strings; this is not a real semantic palette count).
- Distinct border-radius values found: 31 unique values.

Meaningful semantic inventory in the hand-authored system:
- Typography: ~10–12 actual sizes are meaningfully used in app-specific CSS (`0.75rem`, `0.8125rem`, `1rem`, `1.35rem`, `1.5rem`, `2xl`, etc.), but there is no strict scale discipline.
- Colors: the actual app palette is defined in [src/styles.css](../src/styles.css) lines 24-105 as background, foreground, card, muted, brand, accent, destructive, border, and chart 1–5; however, the app also mixes utility classes and hex codes, so the palette is not centrally enforced.
- Border radii: the app uses a small set of recurring radii (`0.4rem`, `0.5rem`, `0.6rem`, `0.75rem`, `999px`, `2xl`, `full`), but they are not tokenized consistently and are repeated in many component styles.

## 6) Stage choice and skipped actions

The stage is not selected by a scene-type switch or explicit view mapping. In [src/components/lesson/LessonPlayer.tsx](../src/components/lesson/LessonPlayer.tsx), it effectively does this:

- `view = scene.view ?? defaultGraphView`
- `hasGraphAction = scene.actions.some(action => graphActions.has(action.do))`
- `shouldShowGrid = view.grid === true || hasGraphAction`
- `shouldShowAxes = view.axes === true || hasGraphAction`
- `hasVisualAction` checks the list of `implementedActions`
- if the action is not in `implementedActions`, it is dropped and only logged via `console.warn`

Implemented action list:
`drawAxes`, `plotFunction`, `plotPoints`, `movePoint`, `showLabel`, `drawLine`, `drawSegment`, `drawVector`, `tangentLine`, `shadeArea`, `drawShape`, `equationStep`, `highlight`, `fade`, `numberLine`, `hopArrow`, `cycleWheel`, `calendarGrid`, `table`, `stepCards`, `counter`, `brace`, `textBlock`, `flowNode`, `flowArrow`, `timeline`.

Skipped / partially supported actions: anything not in that list, including the `graphActions` and section-specific action families that are not normalized by scene type. Result: visual fidelity depends on a loose string-based implementation list rather than explicit scene semantics.

## 7) Controls audit

Existing controls:
- Previous scene, play/pause, next scene, rewind, fast-forward, mute, restart lesson, restart scene, bookmark, fullscreen, speed selector, scene progress indicator, and time caption.
- The engine controls in [src/components/engine/LessonControls.tsx](../src/components/engine/LessonControls.tsx) are quite complete and mostly consistent.

Missing / weak controls:
- No explicit “jump to bookmark” list or visually accessible bookmark summary.
- No clear lesson summary / completion detail after the last scene.
- No robust mobile-only “open to more options” pattern beyond a `details` popover; it is easy to lose context in touch flow.
- No “skip to end” or “step-by-step review” mode beyond manually advancing scenes.
- Tap targets are mostly okay, but some timeline markers and scene dots are too small and are not easy to tap reliably on narrow screens.

## 8) State handling audit

- Loading: [src/components/chat/ChatMessage.tsx](../src/components/chat/ChatMessage.tsx) shows `Thinking…`; [src/components/engine/QuizPanel.tsx](../src/components/engine/QuizPanel.tsx) and [src/components/engine/PracticePanel.tsx](../src/components/engine/PracticePanel.tsx) show `Building your quiz…` / `Building problems…`.
- Error: chat bubble shows red error text; lesson generation shows a retry flow; quiz/practice generation is silent except a small text message.
- Empty: [src/components/chat/ConversationThread.tsx](../src/components/chat/ConversationThread.tsx) shows “What would you like to learn?”
- Lesson complete: [src/components/engine/LessonPlayer.tsx](../src/components/engine/LessonPlayer.tsx) reveals a CTA and quiz/practice buttons only after `playback.finished`, but the completion state is not a dedicated card with a clear summary.

## 9) Accessibility audit

- Missing labels: the main chat input uses a placeholder instead of a label; attach menu inputs are hidden and not programmatically labeled; several controls rely on icon-only presentation without a clear accessible name when dynamic state changes.
- Focus states: there is a focus-visible treatment for only part of the lesson player; the rest of the UI is inconsistent.
- Semantic elements: the app uses buttons and `details`/`summary`, but some menus are effectively popovers without dialog semantics; there is no `aria-live` region for important playback or generation changes beyond isolated cases.
- Contrast: the dark lesson UI is generally readable, but some text over dark backgrounds and some small status text is visually low-contrast at medium sizes.
- Screen reader quality: narration is spoken via `speechSynthesis`, but it is not paired with a robust, screen-reader-friendly status announcement when playback changes or when the player becomes hidden.

## 10) Performance audit

- Re-render hotspots: [src/components/engine/useLessonPlayback.ts](../src/components/engine/useLessonPlayback.ts) runs interval-based state updates and multiple scene-level effects; [src/components/engine/LessonPlayer.tsx](../src/components/engine/LessonPlayer.tsx) also runs a per-frame animation loop while playing.
- Expensive render patterns: each frame in the lesson board recalculates stage geometry and rerenders many SVG nodes; this is acceptable for a single lesson but can become heavy if several lessons are open or the board grows.
- Off-screen animations: there is some guarding with `isVisible`, but the player still renders the full scene and animations even when not in focus; it is better to pause most expensive animations when the player is hidden or when the user is not interacting.
- CSS/DOM churn: inline animation classes and repeated object lists in [src/components/engine/LessonEngine.tsx](../src/components/engine/LessonEngine.tsx) and [src/components/lesson/LessonPlayer.tsx](../src/components/lesson/LessonPlayer.tsx) create extra work for every scene update; a shared CSS animation layer would reduce churn.

## 11) Recommended order of fixes (smallest safe change first)

1. Fix the mobile overflow and narrow-width chat/lesson layout in [src/components/chat/ChatMessage.tsx](../src/components/chat/ChatMessage.tsx) and [src/components/lesson/LessonPlayer.tsx](../src/components/lesson/LessonPlayer.tsx); this is the safest, highest-impact improvement and does not alter lesson logic.
2. Add accessible labels and focus-visible styles to the composer, attach menu, and lesson controls in [src/components/chat/ChatComposer.tsx](../src/components/chat/ChatComposer.tsx), [src/components/site/AttachMenu.tsx](../src/components/site/AttachMenu.tsx), and [src/styles.css](../src/styles.css); this improves usability without changing data flow.
3. Normalize the layout scale by reducing hard-coded pixel sizing and aligning spacing/radius tokens in [src/styles.css](../src/styles.css); this is a low-risk design-system cleanup.
4. Replace the action-name heuristic in [src/components/lesson/LessonPlayer.tsx](../src/components/lesson/LessonPlayer.tsx) with explicit scene metadata or a safe fallback; this is moderate risk because it changes how some lessons render.
5. Improve the lesson-complete and control-state affordances in [src/components/engine/LessonPlayer.tsx](../src/components/engine/LessonPlayer.tsx) and [src/components/engine/LessonControls.tsx](../src/components/engine/LessonControls.tsx) to make progression clearer without altering the underlying lesson engine.
6. Refactor the playback timer model in [src/components/engine/useLessonPlayback.ts](../src/components/engine/useLessonPlayback.ts) and the animation layer in [src/components/engine/LessonEngine.tsx](../src/components/engine/LessonEngine.tsx) to reduce re-render churn; this is a larger change and should be done after the layout/accessibility fixes.

## 12) Risks if these fixes are implemented

- Changing the stage rendering logic in [src/components/lesson/LessonPlayer.tsx](../src/components/lesson/LessonPlayer.tsx) could affect lesson fidelity for custom scenes or edge-case actions that currently depend on permissive heuristics.
- Tightening spacing and radii in [src/styles.css](../src/styles.css) may visually break some already-accepted pages that were built around the current ad hoc values.
- Reworking the playback timers in [src/components/engine/useLessonPlayback.ts](../src/components/engine/useLessonPlayback.ts) could alter autoplay timing, resume behavior, or bookmark math if not carefully normalized.
- Adding stricter accessibility semantics for menu overlays and hidden inputs could change keyboard flow or event ordering in the composer and attach menu unless focus handling is kept consistent.

## Bottom line

The app has a strong visual identity and a good underlying data model, but the UI is currently “mostly correct at large sizes and fragile at small sizes.” The highest-value fix is to stabilize the mobile layout and accessibility basics before deeper changes to stage logic or playback performance.
