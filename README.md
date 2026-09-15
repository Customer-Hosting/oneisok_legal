# OneisOk Legal Consultancy — Static Website

A premium, fully static legal-consultancy website. **HTML5 + CSS3 + vanilla JavaScript + Lenis.**
No framework, no build step, no backend, no database.

---

## Deploying to cPanel

1. In cPanel, open **File Manager** and go to `public_html/`.
2. Upload **everything in this folder**, keeping the directory structure intact.
   (Zip it locally, upload the zip, then use *Extract* — far faster than uploading file by file.)
3. Make sure `.htaccess` uploaded. File Manager hides dotfiles by default:
   **Settings → Show Hidden Files (dotfiles)**.
4. Enable SSL via **Security → SSL/TLS Status → Run AutoSSL**.
5. Once HTTPS works, open `.htaccess` and uncomment the HSTS header and your
   preferred www / non-www redirect block.

That is the whole deployment. There is nothing to install or compile.

### Important: the site must be served over HTTP(S)
Header and footer are injected with `fetch()`, which browsers block on `file://`.
Opening `index.html` by double-clicking will show an unstyled page with no nav.

To preview locally, run any static server from this folder:

```bash
python -m http.server 8000     # then open http://localhost:8000
npx serve .                    # alternative
```

---

## File structure

```
├── index.html              Home
├── about.html              About Us — story, mission, why-us, stats
├── services.html           Services — searchable grid of all 35+
├── team.html               Team Members
├── faq.html                FAQ (+ FAQPage schema)
├── blogs.html              Blogs
├── contact.html            Contact
├── get-quote.html          Get Quote (primary CTA)
│
├── service-detail.html     Template — hydrated from ?s=<slug>
├── blog-post.html          Article template
├── privacy.html · terms.html · disclaimer.html · 404.html
│
├── partials/
│   ├── header.html         Topbar, nav + About Us dropdown, mobile drawer
│   └── footer.html         Footer, mobile action bar, cookie bar
│
├── data/services.json      Single source of truth for all services
│
├── assets/
│   ├── css/
│   │   ├── tokens.css      ← all colours, type, spacing, motion
│   │   ├── base.css        Reset, elements, layout, buttons, utilities
│   │   ├── components.css  Header, hero, cards, accordion, forms, footer
│   │   ├── nav.css         Desktop dropdown + mobile drawer navigation
│   │   └── pages.css       Page-specific layouts
│   ├── js/
│   │   ├── site-config.js  ← all business details (phone, email, address)
│   │   └── main.js         All behaviour
│   └── img/favicon.svg
│
├── .htaccess               HTTPS, clean URLs, gzip, caching, security headers
├── robots.txt · sitemap.xml · site.webmanifest
```

---

## Navigation

Defined once in `partials/header.html` and injected into every page, so the nav
is consistent site-wide and edited in a single file.

```
Home    About Us ▼    Services    Contact    [ Get Quote ]
                │
                ├── About Us
                ├── Team Members
                ├── FAQ
                └── Blogs
```

**Desktop.** The About Us dropdown opens on hover via CSS. A separate caret button
carries `aria-expanded` / `aria-controls` so the menu also opens on click and on
keyboard, while the "About Us" label itself stays a real link to `about.html`.
Arrow keys move through the submenu, Escape closes it and returns focus to the caret,
and a click anywhere outside closes it.

**Mobile (below 1024px).** The hamburger opens a slide-in drawer with a nested
About Us accordion. It closes on outside click, on link selection, on Escape, and
on resize past the desktop breakpoint. Body scroll is locked with `position: fixed`
while open — which preserves the exact scroll position on iOS, unlike
`overflow: hidden` — and is restored on close. Focus is trapped inside the open
drawer and returns to the hamburger afterwards; the closed drawer carries `inert`
so it stays out of the tab order.

The active page is highlighted automatically: `main.js` matches `<body data-page="…">`
against `data-nav="…"` in the nav and sets `aria-current="page"`.

---

## Editing the site

### Change contact details
Edit **`assets/js/site-config.js`** for the JS-driven values, then update the same
details in `partials/header.html`, `partials/footer.html`, and the JSON-LD blocks in
`index.html` and `contact.html`. Search the project for `9331222555` to catch every instance.

### Add or edit a service
Edit **`data/services.json`** only. Adding an entry automatically creates:
- a card on the homepage finder and `services.html`
- a working detail page at `service-detail.html?s=<your-slug>`
- an option in every enquiry form's service dropdown

Each entry needs: `slug`, `title`, `category`, `icon` ([Phosphor](https://phosphoricons.com) name),
`excerpt`, `timeline`, `keywords[]`. Add `"featured": true` to prioritise it.

### Re-theme the site
Edit **`assets/css/tokens.css`**. Every colour, font, space and shadow is a custom
property defined once there, including the dark-mode overrides.

---

## Design system

The visual identity is built to read as a premium Indian legal consultancy:
trust, authority, confidentiality and experience — never decorative.

**Three rules govern everything:**
1. Navy carries authority. Charcoal carries the words. **Gold is earned.**
2. Gold appears only on primary CTAs, small borders, icons, rules, and active
   or hover states. **Never as a section fill.**
3. Edges are near-square, shadows barely register, motion is slight.

### Palette

| Token | Value | Role |
|---|---|---|
| `--color-primary` | `#0A1628` | Deep navy — headers, dark sections, authority |
| `--color-secondary` | `#1F2226` | Dark charcoal — headings and UI structure |
| `--color-accent` | `#B08D3C` | Muted champagne gold — CTA fills, icons, rules |
| `--color-accent-text` | `#7A6420` | Darker gold for gold **text** (contrast) |
| `--color-background` | `#FAF9F7` | Warm off-white page background |
| `--color-white` | `#FFFFFF` | Card and surface white |
| `--color-border` | `#E6E4DF` | Light neutral hairline border |
| `--color-text` | `#1F2226` | Body and heading text |

Full `navy-`, `charcoal-` and `gold-` ramps sit behind these semantic names.
The gold is deliberately desaturated so it reads as brushed metal, not yellow.

**Gold as fill vs. gold as text.** `--color-accent` (gold-500) is for fills,
where dark navy text sits on top (6.23:1). Gold *text* on a light background
uses `--color-accent-text` (gold-700) to clear 4.5:1 — gold-500 would fail.

### Typography

- **Headings:** Playfair Display — an elegant, high-contrast serif.
- **Body:** Inter — neutral and legible at small sizes.
- Every size is fluid via `clamp()`, scaling between a 360px and 1400px viewport
  (`--fs-xs` … `--fs-4xl`). No fixed breakpoint font jumps.

### Restraint, enforced

Verified absent from the stylesheets: neon colours, glassmorphism
(`backdrop-filter`: 0 uses), decorative gradients (only 1px hairline grid
textures and one mask remain), `@keyframes` animations (0), gold-glow shadows,
and playful hover choreography (no decorative rotate/scale).

- **Radius:** 2–8px. `--r-full` survives only on genuine circles and pills —
  avatars, team photos, social buttons, badges.
- **Elevation:** hairline borders do the work; shadows only hint
  (`--sh-sm` … `--sh-xl`, all low-opacity navy).
- **Motion:** 140/240/420ms with restrained easing. Nothing bounces. Scroll
  reveals are opacity + a small translate, and `prefers-reduced-motion` removes
  them entirely.

### Contrast

All ten key colour pairs pass WCAG AA (measured, not assumed):
body text 8.9:1, headings 15.18:1, muted text 5.85:1, gold link text 5.44:1,
CTA label 6.23:1, white on navy 18.13:1.

---

## Forms

Static hosting has no backend, so forms **open a prefilled WhatsApp message** containing
the submitted details (with a `mailto:` fallback shown in the success note). Nothing is
stored on the server.

To switch to a hosted form service later (Formspree, Web3Forms, Getform), set the
endpoint in `assets/js/site-config.js`:

```js
form: { mode: "endpoint", endpoint: "https://formspree.io/f/YOUR_ID" }
```

`main.js` will POST the `FormData` there instead, and fall back to WhatsApp if the
request fails. No other change is needed.

Every form includes a hidden honeypot field (`company_website`) that silently discards
bot submissions, plus client-side validation.

---

## What to replace before launch

- [ ] **Team photos** — currently initials in gradient circles (`team.html`)
- [ ] **Social links** — placeholder `https://www.facebook.com/` etc. in both partials
- [ ] **PNG icons** — `site.webmanifest` references `icon-192/512/maskable.png`; only `favicon.svg` ships. Generate them or remove those entries.
- [ ] **Blog posts** — one full sample article; duplicate `blog-post.html` per post
- [ ] **Testimonials** — original placeholder text; swap for real, consented quotes
- [ ] **Stats** — verify 1,000+ / 10,000+ / 33+ / 18+ are accurate before publishing
- [ ] **Google Analytics** — add your tag to each page if wanted

---

## Technical notes

**SEO.** Unique title/description/canonical per page; Open Graph tags; JSON-LD for
`LegalService` + `LocalBusiness`, `FAQPage`, `BreadcrumbList`, `Article`, and a
per-service `Service` block injected at runtime on detail pages. `sitemap.xml` and
`robots.txt` included — submit the sitemap in Google Search Console after launch.

**Accessibility.** Semantic landmarks, one `h1` per page, skip link, visible focus rings,
ARIA on accordions/drawer/nav, focus trap in the mobile drawer, 44px touch targets,
and full `prefers-reduced-motion` support.

**Performance.** No framework and no build. Animations use only `transform`/`opacity`;
scroll handlers are batched through `requestAnimationFrame`; reveals use
`IntersectionObserver` and unobserve after firing. Lenis and Phosphor load from CDN.

**Browser support.** Modern evergreen browsers. Uses `color-mix()`, `clamp()`,
`aspect-ratio` and `grid-template-rows` transitions — all widely supported since 2023.

**Clean URLs.** `.htaccess` serves `/services` instead of `/services.html` and 301s the
`.html` form so only one URL is indexed. Internal links use `.html` and are redirected
transparently. If you prefer to avoid the redirect hop, strip the extensions from
internal `href`s once deployed.
