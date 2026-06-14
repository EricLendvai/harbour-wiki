# Harbour Wiki

This repository contains the static Harbour Wiki website.

The site is intended to preserve and publish public Harbour language reference material, articles, links, and API reference pages as a simple static website.

## Contents

- `index.html` — Home page
- `articles/` — Static article index and converted article pages
- `links/` — Static links page and links data
- `api/` — Harbour API Explorer page and API data
- `assets/` — Shared CSS and JavaScript
- `images/` — Shared site images
- `scripts/` — Third-party browser assets used by the static pages

## Local testing

Open the repository folder with VSCode and use Live Server, or serve the repository root with any static HTTP server.

The site uses absolute paths such as `/assets/...`, `/articles/...`, and `/images/...`, so it should be tested from the repository root rather than by opening individual HTML files directly from the filesystem.

## Publishing

The repository can be published with GitHub Pages using:

- Source: Deploy from a branch
- Branch: `main`
- Folder: `/ (root)`

## License

Content licensing follows the licensing notices shown on the site and in the relevant source material.
