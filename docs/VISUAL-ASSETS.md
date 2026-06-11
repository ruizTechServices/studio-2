# ruizTechStudio Visual Assets

The visual system uses a route-shaped lowercase `r` connected to system nodes.
It represents code navigation, project recovery, and relationships discovered
inside a repository. Blue is reserved for active paths, extracted assets, and
verified connections.

## Implementation Status

Implemented and currently integrated:

- `BrandLogo` in the marketing navbar, marketing footer, and dashboard sidebar
- `hero-system-recovery.svg` in the homepage hero
- Next.js favicon, scalable icon, and Apple touch icon metadata assets
- `PanelAmbientMotion` in the dashboard project-intake prompt

Implemented and ready for feature adoption:

- Static illustrations for empty projects, repository import, system map,
  reusable assets, and current-status summaries
- `RepoScanAnimation`, `SystemMapAnimation`, `AssetExtractionAnimation`, and
  `ProjectAnalysisLoader`

These available assets should be adopted as the related product surfaces are
built. Do not create placeholder feature routes solely to display them.

## Brand Inventory

| Asset | Path | Intended use |
| --- | --- | --- |
| Primary logo, light surfaces | `public/brand/logo-primary-light.svg` | Marketing pages, light documents |
| Primary logo, dark surfaces | `public/brand/logo-primary-dark.svg` | Dark UI and dark documents |
| Compact mark, light surfaces | `public/brand/logo-mark-light.svg` | Sidebar, app header, avatars |
| Compact mark, dark surfaces | `public/brand/logo-mark-dark.svg` | Dark sidebar and app header |
| Reusable React logo | `components/brand/brand-logo.tsx` | In-product navigation and footer |
| SVG favicon source | `public/brand/favicon.svg` | External integrations and source asset |
| 16px favicon | `public/brand/favicon-16.png` | Legacy favicon reference |
| 32px favicon | `public/brand/favicon-32.png` | Browser and external metadata |
| Multi-size favicon | `app/favicon.ico` | Next.js root favicon convention |
| Next.js SVG icon | `app/icon.svg` | Automatically emitted scalable app icon |
| Apple touch icon | `app/apple-icon.png` | Automatically emitted Apple touch icon |
| 180px Apple touch icon | `public/brand/apple-touch-icon.png` | External manifest use |
| 192px app icon | `public/brand/app-icon-192.png` | PWA or integration manifest |
| 512px app icon | `public/brand/app-icon-512.png` | PWA or integration manifest |

`BrandLogo` automatically follows the design-system foreground and background
colors, so it works in light and dark UI. Use the static light/dark variants
when the logo must leave the application.

```tsx
import { BrandLogo } from '@/components/brand/brand-logo'

<BrandLogo />
<BrandLogo compact />
```

## Placement Illustrations

All placement illustrations are product diagrams, not screenshots or stock
imagery. They have meaningful SVG titles and descriptions.

| Illustration | Path | Recommended placement |
| --- | --- | --- |
| Recovery system overview | `public/illustrations/hero-system-recovery.svg` | Homepage hero; currently in use |
| Empty project workspace | `public/illustrations/empty-project.svg` | Dashboard and project-list empty states |
| Repository import | `public/illustrations/repo-import.svg` | Import/connect screen before scanning |
| System map | `public/illustrations/system-map.svg` | System-map empty state or explainer |
| Reusable asset extraction | `public/illustrations/reusable-assets.svg` | Reusable-assets empty state or explainer |
| Current status summary | `public/illustrations/current-status.svg` | Project status and work-session summary |

Use `next/image` for illustrations shown in the application. Give meaningful
images a useful `alt`; use `alt=""` only when nearby text communicates the same
information and the image is purely decorative.

```tsx
import Image from 'next/image'

<Image
  src="/illustrations/repo-import.svg"
  width={480}
  height={300}
  alt="A repository address flowing into a structured file scan"
/>
```

## Animation Components

Animations are CSS/SVG based, use no additional runtime dependency, and stop
under `prefers-reduced-motion: reduce`.

| Component | Path | Recommended placement |
| --- | --- | --- |
| `RepoScanAnimation` | `components/animations/repo-scan-animation.tsx` | Active repository scan and import progress |
| `SystemMapAnimation` | `components/animations/system-map-animation.tsx` | System-map generation and explainer panels |
| `AssetExtractionAnimation` | `components/animations/asset-extraction-animation.tsx` | Reusable asset extraction progress |
| `ProjectAnalysisLoader` | `components/animations/project-analysis-loader.tsx` | Compact inline analysis status |
| `PanelAmbientMotion` | `components/animations/panel-ambient-motion.tsx` | Subtle motion behind high-priority dashboard panels |

Import from the animation barrel:

```tsx
import {
  AssetExtractionAnimation,
  PanelAmbientMotion,
  ProjectAnalysisLoader,
  RepoScanAnimation,
  SystemMapAnimation,
} from '@/components/animations'
```

Render meaningful animations with their default accessible image label:

```tsx
<RepoScanAnimation className="max-w-md" />
<SystemMapAnimation className="max-w-md" />
<AssetExtractionAnimation className="max-w-md" />
<ProjectAnalysisLoader label="Building system map" />
```

Mark an animation decorative when adjacent copy already explains it:

```tsx
<RepoScanAnimation decorative className="max-w-md" />
```

`PanelAmbientMotion` is always decorative and requires a positioned parent:

```tsx
<section className="relative isolate overflow-hidden rounded-xl border bg-card">
  <PanelAmbientMotion />
  <div className="relative p-6">Panel content</div>
</section>
```

## Usage Rules

- Keep the mark clear of competing icons and preserve at least one node-width of
  surrounding space.
- Do not recolor active paths away from the design system's blue accent.
- Prefer one meaningful illustration per surface.
- Run progress animations only while the represented operation is active.
- Use ambient panel motion sparingly and keep content in a higher stacking layer.
- Do not add animation to error or warning states.

## Verification Record

The visual foundation was verified on June 10, 2026:

- `npm run lint` passed
- `npx tsc --noEmit` passed
- `npm run test` passed: 14 files and 117 tests
- `npm run build` passed with `/icon.svg` and `/apple-icon.png` emitted as static routes
- All 12 SVG assets parsed successfully
- Homepage and dashboard DOM/accessibility checks completed without browser
  console warnings or errors

The in-app browser rendered both surfaces successfully, but screenshot capture
timed out during the verification pass. A dedicated visual-regression baseline
should be added when the project intake surface is implemented.
