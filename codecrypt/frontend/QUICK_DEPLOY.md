# 🚀 Quick Deploy to Netlify

## Step 1: Login to Netlify

Open your terminal in the `codecrypt/frontend` directory and run:

```bash
netlify login
```

This will:
1. Open your browser automatically
2. Ask you to authorize Netlify CLI
3. Once authorized, return to the terminal

**If the browser doesn't open automatically:**
- Copy the URL shown in the terminal
- Paste it into your browser
- Complete the authorization
- Return to the terminal

## Step 2: Initialize the Site

After logging in, run:

```bash
netlify init
```

Follow the prompts:
- **Create & configure a new site** (or link existing)
- **Team:** Choose your team
- **Site name:** `codecrypt-resurrection` (or your choice)
- **Build command:** `npm run build`
- **Publish directory:** `dist`

## Step 3: Deploy

### Option A: Preview Deploy (Recommended First)
Test the deployment without going live:
```bash
netlify deploy
```

### Option B: Production Deploy
Deploy directly to production:
```bash
netlify deploy --prod
```

## Alternative: Use the Deploy Script

We've created a helper script that automates these steps:

```bash
./deploy.sh
```

The script will:
- Check if you're logged in
- Install dependencies if needed
- Build the project
- Guide you through deployment

## After Deployment

Your site will be live at:
- **Production:** `https://[your-site-name].netlify.app`
- **Preview:** `https://[deploy-id]--[your-site-name].netlify.app`

## Features Available in Deployed Site

✅ Live Metrics Dashboard with animated charts
✅ AI Narrator (uses browser speech synthesis)
✅ 3D Ghost Tour visualization
✅ Resurrection Symphony (musical code representation)
✅ Compilation Status display
✅ Gothic/spooky theme

## Troubleshooting

### "Not logged in" error
Run `netlify login` again and complete the browser authorization

### Build fails
- Check that all dependencies are installed: `npm install --legacy-peer-deps`
- Try building locally first: `npm run build`
- Check the Netlify build logs for specific errors

### Site shows blank page
- Check browser console for errors
- Verify the publish directory is set to `dist`
- Check that the build completed successfully

## Need Help?

See the full `DEPLOYMENT_GUIDE.md` for more detailed instructions and troubleshooting.
