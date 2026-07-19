# ACM AJCE

The website for ACM AJCE, the student computing community at Amal Jyothi College of Engineering in Kanjirappally, Kerala.

## Stack

- Astro and Tailwind CSS
- GSAP for motion
- Cloudflare Pages/Workers deployment support
- Keystatic for editable site content

## Run locally

```bash
pnpm install
pnpm dev
```

The development server starts at `http://localhost:4321`.

## Production checks

```bash
pnpm build
pnpm preview
```

## Content and configuration

- Edit site content in `src/content/` or through the Keystatic admin interface.
- Set `RESEND_API_KEY` and `RESEND_FROM` to enable contact form delivery.
- Set `CONTACT_TO_EMAIL` to change the form recipient. It otherwise falls back to `info@ajce.in`.
- Set `KEYSTATIC_GITHUB_REPO_OWNER` and `KEYSTATIC_GITHUB_REPO_NAME` for production content storage when needed.

## Contribution flow

Development happens on `ajce-site` in the fork. When the site is ready, open a pull request from `geo-cherian-mathew-2k28/ACM-AJCE:ajce-site` to `Helixjoe/ACM-AJCE:main`.

## Links

- [Amal Jyothi College of Engineering](https://www.ajce.in/)
- [Association for Computing Machinery](https://www.acm.org/)
