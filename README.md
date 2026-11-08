# Baby Jennings Registry

A gift registry for friends and family: Australian stores, live "still needed" counts, and a private manage mode for Matt & Grace.

- `public/` – the website (index.html, app.js, catalog.json)
- `netlify/functions/api.mjs` – purchases, owner tools, product photos and link reading (stored in Netlify Blobs)

## Setup on Netlify
1. Add new site → Import from GitHub → this repository. Leave the build settings as they are.
2. Site configuration → Environment variables → add `ADMIN_PASSWORD` (your private manage password).
3. Deploy. Open `<your-site>/#manage` and enter the password to get the owner tools.
