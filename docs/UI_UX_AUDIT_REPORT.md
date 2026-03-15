# Imago UI/UX Audit Report

**Date**: 2026-03-15
**Scope**: CombineView, SplitView, ImageActionsToolbar, Global Layouts

## 1. Anti-Patterns Verdict (AI Slop Test)

**Conclusion: Conditional Pass**

- **AI Tells (Needs Improvement)**:
  - **Layout**: Some areas (like the sidebar settings) still follow a repetitive "Icon + Title + Control" stacking pattern, lacking visual rhythm.
  - **Colors**: Heavy reliance on `primary` (usually a green/cyan) on dark backgrounds, a common hallmark of AI-generated code.
  - **Border Radii**: Excessive use of `rounded-3xl` and `rounded-2xl` adds approachability but, if unchecked, detracts from the sharp, professional feel of a production tool.
- **Positive Breakthroughs**:
  - **Interaction**: The introduction of professional-grade pan/zoom canvases and Shift/Ctrl keyboard shortcuts elevates the tool from a "cheap web app" to a "pro tool" experience.
  - **Details**: Removing hover scaling and border radii from the preview items in `CombineView` shows a commitment to precision.

---

## 2. Executive Summary

- **Total Issues Found**: 8
- **Most Critical Issues**:
  1.  **Accessibility**: Keyboard navigation in the interactive canvas has breakpoints (cannot fully control sorting via Tab).
  2.  **Performance**: Potential frame drops when dragging large batches of images (>50) in `CombineView`.
  3.  **Responsive**: The sidebar completely disappears below 768px (`md`), leaving mobile users with no way to access core configuration options.

---

## 3. Detailed Findings by Severity

### High-Severity Issues

- **Location**: `CombineView.vue`, `SplitView.vue` (and `WorkspaceLayout.vue`)
- **Category**: Responsive Design
- **Description**: The sidebar containing essential controls (spacing, alignment, split mode) is hidden on mobile screens (`hidden md:flex`).
- **Impact**: Mobile users cannot adjust any processing parameters, effectively breaking core functionality.
- **Recommendation**: Implement a bottom drawer or collapsible mobile menu for sidebar content.
- **Suggested command**: `/adapt`

### Medium-Severity Issues

- **Location**: Global Components (`AppButton.vue`, icon buttons)
- **Category**: Accessibility (A11y)
- **Description**: Interactive icon-only buttons (like zoom, delete, reset) lack proper `aria-label` attributes in some instances.
- **Impact**: Screen reader users cannot identify the function of these buttons.
- **Recommendation**: Audit all `<button>` elements and ensure they have descriptive `aria-label` or visually hidden text.
- **Suggested command**: `/harden`

- **Location**: `AppSlider.vue` / Global Forms
- **Category**: Theming
- **Description**: Slider colors or form input outlines might rely on hardcoded opacity values instead of standardized design tokens.
- **Impact**: Inconsistent visual feedback when switching between dark and light modes.
- **Recommendation**: Refactor to strictly use `hsl(var(--token))` variables.
- **Suggested command**: `/normalize`

- **Location**: `CombineView.vue`, `SplitView.vue`
- **Category**: Performance
- **Description**: The mouse wheel zoom event handler frequently calls `.getBoundingClientRect()` without throttling or caching.
- **Impact**: Can cause layout thrashing and stuttering during rapid zooming.
- **Recommendation**: Cache the container dimensions using `useElementSize` and only update them on resize.
- **Suggested command**: `/optimize`

### Low-Severity Issues

- **Location**: `SplitView.vue`
- **Category**: Theming
- **Description**: The checkerboard background opacity is fixed at `opacity-40`.
- **Impact**: Might be visually overwhelming in very light themes or indistinct in certain dark setups.
- **Recommendation**: Tie the checkerboard opacity to a specific design token.
- **Suggested command**: `/polish`

- **Location**: `ImageActionsToolbar.vue`
- **Category**: UX Writing
- **Description**: The icons for "Restore Original" (RotateCcw) and "Clear All" (X) might not be instantly intuitive without hover tooltips.
- **Impact**: Slight increase in cognitive load for new users.
- **Recommendation**: Consider adding subtle text labels on larger screens or improving the tooltip visibility.
- **Suggested command**: `/clarify`

---

## 4. Systemic Issues & Patterns

1.  **Responsive Disconnect**: The project heavily favors a "desktop professional tool" experience. The mobile adaptation strategy is currently "hide it" rather than "adapt it."
2.  **State Feedback**: Long-running tasks (like combining many large images) lack granular progress indicators (e.g., percentage or steps), relying only on a generic loading spinner.

---

## 5. Recommended Action Plan

1.  **Immediate (Sprint 1)**:
    - Run `/adapt` to fix the mobile sidebar accessibility issue (crucial for functionality).
    - Run `/harden` to patch missing ARIA labels and keyboard navigation traps.
2.  **Short-term (Sprint 2)**:
    - Run `/optimize` to fix the `getBoundingClientRect` layout thrashing in canvas zoom handlers.
    - Run `/normalize` to ensure all new components strictly use the design system tokens.
3.  **Medium-term (Sprint 3)**:
    - Run `/clarify` to review and refine UX copy and tooltips.
    - Run `/polish` to refine the checkerboard background and other subtle visual details.
