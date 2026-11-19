# Personal website

A one-page personal site (About, Experience, Projects, Blog, Resume) with a live,
self-changing noise background. Plain HTML, CSS and JavaScript: no build step
and nothing to install.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | All the page content, one commented block per section. |
| `assets/css/style.css` | Colours, fonts and layout. The palette is at the top. |
| `assets/js/background.js` | The background. The look of each section is in `PRESETS` at the top. |
| `assets/js/main.js` | Highlights the current section in the navigation, runs the mood slider, and wakes the project demos early. |
| `assets/img/projects/` | Screenshots of the deployed projects. |
| `assets/img/resume-preview.png` | The resume preview shown on the page. |
| `assets/files/Zhuoran-Liu-Resume.pdf` | The resume that the Resume section links to. |
| `CNAME` | Tells GitHub Pages to serve the site at `zhuoran6.com`. |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are. |

## Editing

- **Text and links:** edit `index.html`.
- **Projects:** each project is one `<a class="project">` block in
  `index.html`; the whole card opens the live app. The screenshot sits in a
  device frame: `browser` (with `tilt-a` or `tilt-b`) or `tablet`; or use a
  finished 5:4 picture as `<img class="stage-photo">`, as LoreTour does.
  `--tint` sets the backdrop colour. Keep
  `data-wake` on the card so the page wakes that app early (see below).
- **Resume:** replace `assets/files/Zhuoran-Liu-Resume.pdf`, then remake the
  preview image (macOS):

  ```bash
  swift tools/pdf2png.swift assets/files/Zhuoran-Liu-Resume.pdf assets/img/resume-preview.png 1700
  ```

  (Don't use `sips` for this: it renders the PDF at screen resolution and
  then enlarges it, which is why the old preview was blurry.)
- **Colours:** text and accent colours are the variables under `:root` in
  `style.css`. The page colour of each section is `page` in `PRESETS` in
  `background.js`, and `tint` is the colour of its pattern.
- **Background:** each section has a `data-bg="name"` attribute, and
  `PRESETS` in `background.js` has an entry with the same name. The comment
  above `PRESETS` explains each setting. Keep `contrast` modest so text stays easy
  to read.
- **Cursor lamp:** the glow that follows the cursor is set by `LAMP` in
  `background.js` (its size, how much it brightens the page, how much it calms
  the pattern, and how strongly the pattern bends around it).
- **Mood slider:** "How's your week going?" in About. The replies are in
  `REPLIES` in `main.js`; how far it pushes the background is `MOOD` in
  `background.js`. The visitor's answer is remembered in their browser only.
- **Waking the demos:** the projects run on Render's free plan, which sleeps
  after about 15 minutes idle and takes 15 to 30 seconds to wake. `main.js`
  pings every card marked `data-wake` shortly after this page loads, so they
  are usually awake by the time someone clicks.
- **New section:** add a `<section id="..." data-bg="...">`, a link in the
  navigation, and a matching entry in `PRESETS`.

## Preview on your computer

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Publish with GitHub Pages

The site lives in the GitHub repository `zhuan0352/portfolio` and is served
from its `main` branch at <https://zhuoran6.com>. To update the
live site, commit your changes and push:

```bash
git push origin main
```

The new version is live within a minute or so.

### Domain

`zhuoran6.com` is the site's custom domain (the `CNAME` file), with HTTPS
enforced. Its DNS is managed in Cloudflare: four `A` records for the bare
domain pointing at GitHub Pages (`185.199.108.153`, `185.199.109.153`,
`185.199.110.153`, `185.199.111.153`) and a `www` `CNAME` record pointing at
`zhuan0352.github.io`. Keep them set to **DNS only** (grey cloud) so GitHub
can renew the certificate.
