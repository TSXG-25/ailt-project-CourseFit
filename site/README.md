# CourseFit project page

A static, single-page overview of CourseFit: the problem it solves, what the prototype does, screenshots from the running app, engineering notes and the verification record.

The page is plain HTML, CSS and a small progressive-enhancement script. There is no build step, no framework and no external request — fonts, icons and screenshots are served from this folder, so it also works from a USB stick or any static host.

## Preview locally

Any static file server works:

```sh
python -m http.server 8080 --directory site
```

Open <http://127.0.0.1:8080>. Opening `site/index.html` directly from the filesystem also works, except that `file://` blocks clipboard access for the copy button.

## Publish with GitHub Pages

1. Push this folder to the repository's `main` branch.
2. In **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
3. Run the **Deploy project page** workflow, or push a change under `site/`.

`.github/workflows/pages.yml` uploads `site/` as the Pages artifact, so only the page — not the planner source — is published. The site URL is shown in the workflow run and in **Settings → Pages**.

Private repositories can publish Pages only on plans that include it. If Pages is unavailable, the same folder can be dropped onto any static host (Netlify Drop, Cloudflare Pages, a university web directory) without changes.

If the repository stays private, the GitHub links on the page will not resolve for visitors. Either make the repository public before sharing the page, or point those links at a public mirror.

## What to edit

| File | Contents |
| --- | --- |
| `index.html` | All page copy, section structure, links and metadata. |
| `styles.css` | Layout, palette and responsive rules, in cascade layers. |
| `site.js` | Sticky header state and the terminal copy button. |
| `assets/` | Screenshots, favicon and the social preview image. |

Screenshots are real captures of the planner at 1440 px; the WebP is served first with a PNG fallback. Re-capture them from `npm start` whenever the interface changes materially, and keep the aspect ratios in the `width`/`height` attributes.

The palette matches the planner (`--ink`, `--blue`, `--cloud`, `--green`) so the page and the app read as one product.

## Notes

- Links point at `https://github.com/TSXG-25/ailt-project-CourseFit`. Update them here and in `site.js` if the repository moves.
- `og:image` uses a relative path. Some social crawlers require an absolute URL; set it to the published Pages URL once the address is known.
- The page contains no analytics, cookies or third-party scripts.
