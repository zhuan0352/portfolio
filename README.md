# Personal website

A one-page personal site (About, Experience, Blog, Projects, Resume) with a live,
self-changing noise background. Plain HTML, CSS and JavaScript: no build step
and nothing to install.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | All the page content, one commented block per section. |
| `assets/css/style.css` | Colours, fonts and layout. The palette is at the top. |
| `assets/js/background.js` | The background. The look of each section is in `PRESETS` at the top. |
| `assets/js/main.js` | Highlights the current section in the navigation. |
| `assets/img/` | Project pictures and the resume preview image. |
| `assets/files/Zhuoran-Liu-Resume.pdf` | The resume that the Resume section links to. |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are. |

## Editing

- **Text, links, projects:** edit `index.html`. To add a project, copy one
  `<article class="card">` block and put its picture (16:9 works best) in
  `assets/img/`.
- **Resume:** replace `assets/files/Zhuoran-Liu-Resume.pdf`, then remake the
  preview image (macOS):

  ```bash
  sips -s format png --resampleWidth 1400 assets/files/Zhuoran-Liu-Resume.pdf --out assets/img/resume-preview.png
  ```
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
- **New section:** add a `<section id="..." data-bg="...">`, a link in the
  navigation, and a matching entry in `PRESETS`.

## Preview on your computer

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Publish with GitHub Pages

The site lives in the GitHub repository `zhuan0352/zhuan0352.github.io` and is
served from its `main` branch at <https://zhuan0352.github.io>. To update the
live site, commit your changes and push:

```bash
git push origin main
```

The new version is live within a minute or so.

### Moving zhuoran6.com to this site

1. On GitHub, open the repository's **Settings → Pages** and enter
   `zhuoran6.com` under **Custom domain**. GitHub adds a `CNAME` file to the
   repository; run `git pull` afterwards so your copy has it too.
2. In Cloudflare (where the domain's DNS is managed), replace the two `A`
   records for `zhuoran6.com` with GitHub's four: `185.199.108.153`,
   `185.199.109.153`, `185.199.110.153` and `185.199.111.153`. Point the `www`
   `CNAME` record at `zhuan0352.github.io`. Set these records to **DNS only**
   (grey cloud) so GitHub can issue the HTTPS certificate.
3. Back in **Settings → Pages**, tick **Enforce HTTPS** once it is offered.
4. Remove the domain from the old Netlify site.

## Picture credits

Project pictures are from [Unsplash](https://unsplash.com) under the Unsplash
licence:

- `ai-stock-clerk.jpg`: <https://unsplash.com/photos/a-store-shelf-filled-with-lots-of-different-items-KzT5IWf0yHQ>
- `betterlife-fitness.jpg`: <https://unsplash.com/photos/a-row-of-dumbs-in-a-gym-m4Jqyv5VwqY>
