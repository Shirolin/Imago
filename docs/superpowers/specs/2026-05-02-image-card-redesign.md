# Design Spec: ImageCard 2.0 (Reactive HUD Model)

**Date**: 2026-05-02
**Topic**: Redesign of the core ImageCard component to improve visual hierarchy and professional utility.

## 1. Feature Summary

ImageCard 2.0 is the primary asset management unit in Imago. It transitions from a static layout to a **Reactive HUD model**, where information density and interactive controls adapt dynamically to the user's focus (Hover) and the global view mode (Large vs. Compact).

## 2. Primary User Action

Users interact with the card to select/deselect images, monitor processing progress, compare before/after results, and trigger downloads.

## 3. Design Direction

**Adaptive Professionalism.**
Consistent with the "Stitch" aesthetic: precise, physical, and reactive. The card should feel like a physical object in a high-tech workshop—clean when idle, but rich with data and controls when focused.

## 4. Component Structure (Layering)

### Layer 1: Canvas (4:3 Aspect Ratio)

- **Background**: Checkerboard transparency grid or solid fill.
- **Preview**: High-fidelity image preview.
- **Overlays**:
  - **Top-Left**: Multi-select checkbox. Persistent if selected; visible on hover if not.
  - **Top-Right**: Delete button. High-contrast danger style on hover.
  - **Center**: Minimal circular progress indicator during `processing` status.
  - **Bottom HUD**: Glassmorphism tray appearing from the bottom edge on hover.
    - Contains: [Compare Button], [Reset Button], [Download Button].
    - **Reactive Step**: In Compact mode, also displays [Dimensions] and [File Size] within this HUD.

### Layer 2: Info Area (Bottom)

- **Title**: Filename with `truncate` and bold weights.
- **Large Mode**:
  - Persistent Format Tag (e.g., "WEBP").
  - Persistent Tech Specs: "1920 × 1080 | 2.45 MB".
  - Status Pills: Mint for "Done", Amber for "Dirty".
- **Compact Mode**:
  - Persistent Filename only.
  - Status Icons (shorthand) next to filename.
  - _Note: Detailed specs move to the Hover HUD in this mode._

## 5. Key States & Feedback

- **Idle**: Clean border, subtle shadow.
- **Processing**: Entire preview desaturated + blurred (2px), center loader active.
- **Done**: Mint green status pill/icon, high-contrast preview.
- **Dirty**: Right-side amber glowing border (breathing effect), status icon changes to "RotateCcw".
- **Hover**: Card lifts `-2px`, shadow deepens to `shadow-elevated`, HUD slides up.

## 6. Technical Requirements

- **Container Queries**: Use `@container` to handle internal layout shifts regardless of global viewport.
- **Tabular Nums**: All numeric data (dimensions, sizes) must use `font-variant-numeric: tabular-nums`.
- **Transitions**: Use `cubic-bezier(0.32, 0.72, 0, 1)` (Apple/Ease-Out Expo) for all transforms.

## 7. Implementation Roadmap

1. Update `ImageCard.vue` template structure.
2. Implement CSS Container Queries for mode-specific styling.
3. Integrate local-result props (from previous refactor).
4. Add refined SVG icons and micro-animations.

## 8. Open Questions

- Should the "Dirty" state also prevent downloading the old version? (Decision: No, but show warning tooltip).
