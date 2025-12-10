## 2025-05-18 - Accessibility on Wrappers
**Learning:** React wrapper components (like `Button`) that manually destructure props often swallow accessibility attributes like `aria-label` or `data-*` unless `...rest` is explicitly passed.
**Action:** Always verify that UI component wrappers accept and pass down `...rest` props or explicitly extend the underlying HTML attributes interface.
