# Accessibility Checklist (Editor & UI)

- Keyboard navigation: all toolbar, menus, dialogs reachable via Tab/Shift+Tab
- Shortcuts: Ctrl/Cmd+B/I/U, Alt+1–6 for headings, Esc closes menus
- ARIA roles and labels for toolbar buttons and menus
- Focus states visible with high contrast theme
- Screen reader announcements for formatting toggles and slash menu actions
- RTL support and locale-aware formatting
- Color contrast: WCAG AA for text and icons
- Responsive behavior verified at mobile, tablet, desktop breakpoints

Testing hooks (manual/CI suggestion):
- Use React Testing Library + axe to scan key views
- Snapshot themes (default/high contrast) for visual regressions
