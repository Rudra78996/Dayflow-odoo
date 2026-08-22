# Decision 0003 — Dayflow design system

Status: Accepted  
Date: 2026-08-22

## Decision

- shadcn/ui Base UI primitives with the `base-nova` style.
- Self-hosted Geist Sans and Geist Mono through the `geist` package.
- Lucide as the only application icon library.
- Porcelain surfaces, graphite text, aubergine primary, teal success, amber warning, coral destructive, and violet leave.
- A 12px base radius and flat surfaces with fine rings. No gradients, glass effects, or excessive nested cards.
- Status always includes text and semantic badge treatment, never color alone.
- The slim aubergine workday rail is the signature dashboard composition.

## Component rules

Forms use `FieldGroup`/`Field`; dialogs include title and description; profiles use full `Tabs` composition; identities include `AvatarFallback`; links use `buttonVariants` when button styling is needed. Screens support keyboard navigation and remain usable from phone widths through 1366×768 laptops.
