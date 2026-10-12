# Header and brand implementation plan

Goal: Apply approved black/white quote-and-frame branding, compact header, discoverable account menu, and browser icons.

- [x] Inspect current components and Next.js local icon documentation.
- [x] Add failing brand/menu regression tests.
- [x] Replace wordmark with scalable quote/frame SVG; add matching browser and touch icons.
- [x] Align header/search/categories with approved design; preserve filter functionality and responsive layout.
- [x] Add publish entry with honest coming-soon popover (publishing API is not yet implemented).
- [x] Add visible menu chevron, hover/open/focus states; move signed-in preferences into menu.
- [x] Run tests/typecheck/lint, browser-check desktop/mobile and menu, then review changes.

No production deployment is part of this change.

Validation: 62 unit/integration tests passed, TypeScript and ESLint passed; browser checked desktop dark/light and 390px mobile, no horizontal overflow. Browser confirmed favicon declarations and publish popover. Signed-in menu behavior verified with real Base UI component tests; live local browser was signed out.
