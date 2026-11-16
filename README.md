# ACM AJCE — Official Web Platform & Chapter Portal

[![Astro](https://img.shields.io/badge/Astro-5.16-BC52EE.svg?style=flat-square&logo=astro&logoColor=white)](https://astro.build)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC.svg?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black.svg?style=flat-square&logo=three.js&logoColor=white)](https://threejs.org)
[![Keystatic](https://img.shields.io/badge/CMS-Keystatic-FF5A5F.svg?style=flat-square)](https://keystatic.com)
[![Deployment](https://img.shields.io/badge/Deployment-Vercel-black.svg?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com)

Welcome to the central repository for the **ACM Student Chapter** and **ACM-W Chapter** at **Amal Jyothi College of Engineering (AJCE)**, Kanjirappally, Kerala.

This repository powers the official website ([ajce.acm.org](https://ajce.acm.org)), featuring an interactive 3D landing experience, dynamic event timelines, photo galleries, membership onboarding with digital ID generation, and an automated certificate verification engine.

---

## 📑 Table of Contents

1. [Executive Overview & Architecture](#-executive-overview--architecture)
2. [Technology Stack](#-technology-stack)
3. [Project Directory Layout](#-project-directory-layout)
4. [Responsive Dual-Variant Architecture](#-responsive-dual-variant-architecture)
5. [Core Subsystems & Technical Details](#-core-subsystems--technical-details)
   - [Hero & 3D Interactive Canvas](#1-hero--3d-interactive-canvas)
   - [SWork Event Cassette System](#2-swork-event-cassette-system)
   - [Photo Gallery System (Desktop & Mobile)](#3-photo-gallery-system-desktop--mobile)
   - [Membership Portal & Digital ID Card Generator](#4-membership-portal--digital-id-card-generator)
   - [Certificate Verification Engine](#5-certificate-verification-engine)
   - [Keystatic Headless CMS](#6-keystatic-headless-cms)
6. [Asset Pipeline & CDN Integration](#-asset-pipeline--cdn-integration)
7. [Environment Variables Reference](#-environment-variables-reference)
8. [Local Development Guide](#-local-development-guide)
9. [Build & Deployment Workflows](#-build--deployment-workflows)
10. [Webmaster Handover Checklist & Runbooks](#-webmaster-handover-checklist--runbooks)
    - [How to Add New Event Photos to the Gallery](#runbook-1-adding-event-glimpses-to-the-gallery)
    - [How to Update Executive Board Members](#runbook-2-updating-the-executive-board)
    - [How to Publish a New Event](#runbook-3-publishing-a-new-event)
    - [How to Issue Certificates for Verification](#runbook-4-issuing-certificates)

---

## 🏛 Executive Overview & Architecture

The application is structured as a **hybrid SSR + Prerendered Astro 5 application** deployed to **Vercel** (`@astrojs/vercel` server adapter) with edge CDN asset acceleration.

```
                              ┌────────────────────────────────────────┐
                              │            Incoming Request            │
                              └──────────────────┬─────────────────────┘
                                                 │
                                                 ▼
                              ┌────────────────────────────────────────┐
                              │        Astro 5 Hybrid Router           │
                              └──────┬───────────────────────────┬─────┘
                                     │                           │
                    Static / Prerendered Routes           Server API Endpoints
                                     │                           │
                  ┌──────────────────┴─────────────┐             │
                  ▼                                ▼             ▼
       ┌──────────────────────┐         ┌──────────────────┐  ┌─────────────────────┐
       │     Landing Page     │         │   Grep / Static  │  │  /api/payments/*    │
       │   (index.astro)      │         │   (/grep.astro)  │  │  /api/auth/*        │
       │                      │         └──────────────────┘  │  /api/membership/*  │
       │ ┌──────────────────┐ │                               │  /api/contact       │
       │ │ Desktop Variant  │ │                               │  /api/verify-qr.png │
       │ ├──────────────────┤ │                               └──────────┬──────────┘
       │ │ Mobile Variant   │ │                                          │
       │ └──────────────────┘ │                                          ▼
       └──────────────────────┘                               ┌─────────────────────┐
                                                              │  External Services  │
                                                              │  • Firebase Store   │
                                                              │  • Razorpay Payment │
                                                              │  • Resend Email API │
                                                              │  • Cloudflare R2    │
                                                              └─────────────────────┘
```

---

## 🛠 Technology Stack

| Layer | Framework / Library | Primary Purpose |
|---|---|---|
| **Core Framework** | [Astro v5.16](https://astro.build) | Islands architecture, zero-JS by default, ultra-fast SSR & static rendering |
| **Component Islands** | [React 19](https://react.dev) | Interactive micro-frontends (ID card canvas, payment flows, modals) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) + `@tailwindcss/vite` | Modern utility-first CSS engine with PolySans design tokens |
| **3D Graphics** | [Three.js](https://threejs.org) + `postprocessing` | Interactive 3D hero canvas with dynamic lighting and camera motions |
| **Animation Engine** | [GSAP 3](https://greensock.com) + ScrollTrigger | High-performance timeline animations, cassette sliders, scroll triggers |
| **Headless CMS** | [Keystatic](https://keystatic.com) | Git-backed visual CMS for non-technical editors (Events, Board, Domains) |
| **Database & Auth** | [Firebase](https://firebase.google.com) (Firestore & Auth) | Certificate verification registry, member profiles, Google OAuth |
| **Payment Gateway** | [Razorpay](https://razorpay.com) | Secure checkout for chapter memberships and symposium ticket sales |
| **Email Delivery** | [Resend](https://resend.com) | Reliable transactional email notifications from the contact form |
| **Asset Storage** | Cloudflare R2 / AWS S3 | Edge CDN asset serving via `scripts/upload-r2.mjs` |

---

## 📂 Project Directory Layout

```
acm-ajce-website/
├── keystatic.config.ts          # Keystatic CMS schemas and singleton definitions
├── astro.config.mjs             # Astro build, Vercel adapter, and Tailwind configuration
├── package.json                 # Project dependencies and script declarations
├── tsconfig.json                # TypeScript compiler configuration
│
├── public/                      # Static assets served from root
│   ├── gallery/acm-ajce/        # Photo gallery images (workshops, hackathons, Aithra)
│   ├── events/                  # Event banners and cassette covers
│   ├── board/                   # Executive board portraits
│   ├── partners/                # Partner and sponsor brand logos
│   ├── domains/                 # Domain badges and iconography
│   └── models/                  # 3D assets (GLTF/GLB models for Three.js)
│
├── scripts/
│   ├── upload-r2.mjs            # Production script to synchronize public assets to R2 CDN
│   └── image-update.sh          # Batch image optimization script
│
└── src/
    ├── assets/                  # Bundled assets (fonts: PolySans Trial, vectors)
    ├── content/                 # Keystatic JSON data sources
    │   ├── board.json           # Active chapter executive board members
    │   ├── events.json          # Timeline cassette events & descriptions
    │   ├── domains.json         # Technical domains (Web, AI, Mobile, Design, etc.)
    │   ├── partners.json        # Academic and industry sponsors
    │   └── site-config.json     # Global site parameters
    │
    ├── layouts/
    │   └── Layout.astro         # Master HTML shell (meta tags, theme script, font preload)
    │
    ├── components/              # Desktop-optimized components
    │   ├── Hero.astro           # 3D canvas and introductory landing hero
    │   ├── SWork.astro          # Interactive horizontal cassette event showcase
    │   ├── Gallery.astro        # Desktop gallery trigger banner & floating background
    │   ├── ProofGallery.astro   # Fullscreen desktop modal gallery & lightbox viewer
    │   ├── Board.astro          # Executive committee flip cards & profiles
    │   ├── ContactUs.astro      # Desktop contact form with Resend integration
    │   ├── Header.astro         # Desktop navigation header & status indicators
    │   └── Footer.astro         # Site footer and social links
    │
    ├── phoneComponents/         # Mobile-first optimized components
    │   ├── About_Phone.astro    # Lightweight touch-friendly about section
    │   ├── Gallery_Phone.astro  # Mobile gallery with category filters & touch swipe
    │   └── ContactUs_Phone.astro# Mobile contact sheet
    │
    ├── pages/
    │   ├── index.astro          # Root landing page (Dual-variant dispatcher)
    │   ├── grep.astro           # GREP flagship event showcase
    │   ├── verify.astro         # Certificate verification engine
    │   ├── execom/index.astro   # Complete Executive Committee directory
    │   ├── membership/          # Membership application & digital ID pass generator
    │   └── api/
    │       ├── auth/            # Google OAuth endpoints
    │       ├── payments/        # Razorpay order generation & webhook verification
    │       ├── membership/      # Member profile management
    │       └── contact.ts       # Contact form submission handler via Resend
    │
    ├── styles/
    │   └── globals.css          # Global CSS, PolySans @font-face, dark/light themes
    └── utils/
        ├── cdn.ts               # Asset URL resolver (prefixes PUBLIC_CDN_URL if configured)
        └── reader.ts            # Keystatic singleton reader utility
```

---

## 📱 Responsive Dual-Variant Architecture

Unlike traditional websites that hide elements via CSS (`hidden md:block`), this project utilizes a **Smart Dual-Variant Host Architecture** in `src/pages/index.astro`.

### Why Dual-Variant?
Heavy desktop components (such as complex Three.js canvases, DOM-heavy cassette timelines, and 3-column modal grids) consume significant memory and CPU cycles on mobile devices.

### How it Works:
```html
<section id="gallery" class="page-section">
  <div data-variant-host>
    <template data-variant="desktop">
      <Gallery />
    </template>
    <template data-variant="mobile">
      <Gallery_Phone />
    </template>
  </div>
</section>
```
1. Mobile devices only unpack and hydrate `phoneComponents/Gallery_Phone.astro`.
2. Desktop browsers unpack and hydrate `components/Gallery.astro` and `ProofGallery.astro`.
3. This guarantees near-instant mobile First Contentful Paint (FCP) and prevents memory exhaustion on low-power phones.

---

## ⚡ Core Subsystems & Technical Details

### 1. Hero & 3D Interactive Canvas
- **Location:** `src/components/hero.astro`
- **Implementation:** Uses Three.js with perspective camera, ambient & directional lighting, and custom shader passes.
- **Performance:** Includes an automatic visibility observer; when the user scrolls past the hero section, the render loop pauses to preserve GPU battery.

### 2. SWork Event Cassette System
- **Location:** `src/components/SWork.astro`
- **Data Source:** `src/content/events.json`
- **Mechanics:** Custom GSAP horizontal translation pinned to vertical window scroll. Event items dynamically scale scroll distance based on `getEventSectionScrollMultiplier(itemCount)`.

### 3. Photo Gallery System (Desktop & Mobile)
- **Desktop:** `src/components/ProofGallery.astro`
  - Triggered by `#proof-gallery-modal` via `window.openProofGallery()`.
  - Grid layout of photographic cassettes with interactive hover overlay.
  - Lightbox viewer supporting keyboard arrows (`←`, `→`, `Escape`) and click navigation.
- **Mobile:** `src/phoneComponents/Gallery_Phone.astro`
  - 2-column mobile grid with permanent tag indicators (`Aithra '26`, `Hands-on`, `Design`).
  - Interactive horizontal filter pills (`ALL`, `AITHRA '26`, `WORKSHOPS`, `3D FORGE`, `TALKS`, `COMMUNITY`).
  - Fullscreen touch lightbox with native swipe-gesture support (`touchstart` / `touchend`).

### 4. Membership Portal & Digital ID Card Generator
- **Location:** `src/pages/membership/index.astro`
- **Capabilities:**
  - Authenticates users via Google Sign-In (`/api/auth/google`).
  - Integrates Razorpay checkout for membership subscriptions.
  - Dynamically renders an official ACM AJCE digital membership card on an HTML5 canvas.
  - Exports crisp, printable PDF passes with embedded verification QR codes.

### 5. Certificate Verification Engine
- **Location:** `src/pages/verify.astro`
- **Backend API:** `src/pages/api/verify-qr.png.ts`
- **Database:** Firebase Firestore collection `certificates`
- **Verification Flow:**
  1. Participant scans certificate QR code or visits `/verify?id=CERT_ID`.
  2. The page queries Firestore for matching recipient credentials, event title, and issue date.
  3. Displays an authentic digital credential badge with tamper verification status.

### 6. Keystatic Headless CMS
- **Access Route:** `/keystatic` (or `/admin`)
- **Configuration:** `keystatic.config.ts`
- **Storage Strategy:**
  - **Local Development:** Writes directly to `src/content/*.json`.
  - **Production:** Commits directly to the GitHub repository via GitHub Octokit API when `NODE_ENV=production`.

---

## 🌐 Asset Pipeline & CDN Integration

All media referenced in components passes through the `getAssetUrl()` helper in `src/utils/cdn.ts`:

```typescript
import { getAssetUrl } from "../utils/cdn";

// Resolves to "/gallery/acm-ajce/example.jpg" locally
// Resolves to "https://cdn.ajce.acm.org/gallery/acm-ajce/example.jpg" if PUBLIC_CDN_URL is configured
const imageUrl = getAssetUrl("/gallery/acm-ajce/example.jpg");
```

### Uploading Assets to Cloudflare R2 / S3
When new high-resolution images or videos are added to `public/`, upload them to the CDN using the included sync script:
```bash
pnpm deploy:cdn
```
*(Requires `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME` in `.env`).*

---

## 🔑 Environment Variables Reference

Create a `.env` file in the root directory:

```env
# ─── Public CDN Configuration ───
PUBLIC_CDN_URL=https://cdn.ajce.acm.org

# ─── Contact Form (Resend) ───
RESEND_API_KEY=re_xxxxxxxxxxxxxx
RESEND_FROM="ACM AJCE <noreply@ajce.acm.org>"
CONTACT_TO_EMAIL=acm@ajce.in

# ─── Keystatic CMS GitHub Storage ───
KEYSTATIC_GITHUB_REPO_OWNER=geo-cherian-mathew-2k28
KEYSTATIC_GITHUB_REPO_NAME=ACM-AJCE
KEYSTATIC_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ─── Razorpay Payment Integration ───
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxx

# ─── Firebase (Certificates & Auth) ───
PUBLIC_FIREBASE_API_KEY=AIzaSyxxxxxxxxxxxxxx
PUBLIC_FIREBASE_AUTH_DOMAIN=acm-ajce.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID=acm-ajce
PUBLIC_FIREBASE_STORAGE_BUCKET=acm-ajce.appspot.com
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxxxxxxxxx
PUBLIC_FIREBASE_APP_ID=1:xxxxxxxxxx:web:xxxxxxxxxx
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'

# ─── Cloudflare R2 Sync (Optional for pnpm deploy:cdn) ───
R2_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxx
R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxx
R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxx
R2_BUCKET_NAME=acm-assets
```

---

## 💻 Local Development Guide

### Prerequisites
- **Node.js:** `v20.x` or later
- **pnpm:** `v10.x` (Recommended package manager)

### Installation
```bash
# Clone the repository
git clone https://github.com/geo-cherian-mathew-2k28/ACM-AJCE.git
cd ACM-AJCE

# Install dependencies
pnpm install

# Start local development server
pnpm dev
```
Open [http://localhost:4321](http://localhost:4321) in your browser.  
To access the local Keystatic CMS admin, visit [http://localhost:4321/keystatic](http://localhost:4321/keystatic).

---

## 🚀 Build & Deployment Workflows

### Testing the Production Build
Before pushing any code, always test the full server bundle locally:
```bash
# Compile client and server bundles
pnpm run build

# Preview the output
pnpm run preview
```

### Git Collaboration & Deployment Strategy
1. **Branching Model:** Development occurs on the active working branch (`ajce-site`).
2. **Pull Requests:** Open pull requests against `main` for production releases.
3. **Vercel Automation:** Every push to the connected repository triggers an automatic preview or production deployment.

---

## 📋 Webmaster Handover Checklist & Runbooks

### Runbook 1: Adding Event Glimpses to the Gallery

Whenever an event concludes (e.g. Aithra Tech Fest, Infera, GitStarted, Hackathons):

1. **Place the Photos:**
   Add optimized JPG/PNG images into `public/gallery/acm-ajce/`.
   *Tip: Keep individual images under 5MB or convert to WebP for maximum performance.*

2. **Register in Desktop Gallery (`src/components/ProofGallery.astro`):**
   Add your items to the array inside lines 65–85:
   ```astro
   { src: "/gallery/acm-ajce/My-Event-1.jpg", category: "Aithra Tech Fest 2026", title: "Keynote Session" },
   ```

3. **Register in Mobile Gallery (`src/phoneComponents/Gallery_Phone.astro`):**
   Add matching items to `galleryItems`:
   ```typescript
   { src: "/gallery/acm-ajce/My-Event-1.jpg", title: "Keynote Session", category: "Workshops Aithra '26", tag: "Aithra '26" },
   ```
   *Note: If introducing a new category, add it to `const categories = [...]` at the top of the file.*

4. **Verify Build:**
   Run `pnpm run build` to ensure all asset paths and components build cleanly.

---

### Runbook 2: Updating the Executive Board

When the new chapter executive committee (Execom) takes office:

1. Open `/keystatic` locally or on production (`/admin`).
2. Navigate to **Board Members**.
3. Update portraits in `public/board/` and fill in names, positions, LinkedIn, GitHub, and Google Scholar URLs.
4. Set the `ACM-W Member` checkbox for ACM-W office bearers.
5. Save changes (Keystatic will write directly to `src/content/board.json`).

---

### Runbook 3: Publishing a New Event

1. Place the event promotional banner in `public/events/`.
2. Open `/keystatic` and navigate to **Events**.
3. Add a new cassette image and configure the event info (Title, description, registration link).
4. Save changes (Keystatic updates `src/content/events.json`).

---

### Runbook 4: Issuing Certificates

1. Access the Firebase Console for the ACM AJCE project.
2. Under Firestore Database, navigate to the `certificates` collection.
3. Create a document with the unique certificate ID (e.g., `ACM-AITHRA-2026-001`):
   ```json
   {
     "recipientName": "Jane Doe",
     "event": "INFERA: Blender & 3D Workshop",
     "position": "Participant / Winner",
     "date": "February 2026",
     "issuedBy": "ACM AJCE Chapter Chair"
   }
   ```
4. The recipient can immediately verify their certificate at:
   `https://ajce.acm.org/verify?id=ACM-AITHRA-2026-001`

---

## 🤝 Community & Credits

- **Host Institution:** [Amal Jyothi College of Engineering (AJCE)](https://www.ajce.in)
- **Parent Organization:** [Association for Computing Machinery (ACM)](https://www.acm.org)
- **Maintained by:** ACM AJCE Web Development Team & Chapter Webmasters
- **Original Inspiration:** ACM VIT Student Chapter design architecture

For inquiries, support, or bug reports, contact the chapter tech team at `acm@ajce.in`.
