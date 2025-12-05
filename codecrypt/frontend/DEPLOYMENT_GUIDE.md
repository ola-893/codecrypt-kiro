# CodeCrypt Frontend Deployment Guide

## Quick Deploy to Netlify

### Prerequisites
- Netlify account (sign up at https://app.netlify.com/signup if needed)
- Netlify CLI installed globally (already done: `npm install -g netlify-cli`)

### Step 1: Login to Netlify
```bash
cd codecrypt/frontend
netlify login
```
This will open your browser for authentication.

### Step 2: Initialize and Deploy

#### Option A: Create New Site
```bash
netlify init
```
Follow the prompts:
- Create & configure a new site
- Choose your team
- Site name: `codecrypt-resurrection` (or your preferred name)
- Build command: `npm run build`
- Publish directory: `dist`

#### Option B: Link Existing Site (if you already created one)
```bash
netlify link --git-remote-url git@github.com:ola-893/codecrypt-kiro.git
```

### Step 3: Deploy

#### For Production Deploy:
```bash
netlify deploy --prod
```

#### For Preview Deploy (test first):
```bash
netlify deploy
```

### Step 4: Configure Environment Variables (if needed)

If your app needs environment variables:
```bash
netlify env:set VARIABLE_NAME value
```

Or set them in the Netlify UI:
1. Go to Site settings > Environment variables
2. Add your variables

## Manual Deploy via Netlify UI

If CLI doesn't work, you can deploy via the web interface:

1. Go to https://app.netlify.com
2. Click "Add new site" > "Import an existing project"
3. Connect to GitHub and select `ola-893/codecrypt-kiro`
4. Configure build settings:
   - Base directory: `codecrypt/frontend`
   - Build command: `npm run build`
   - Publish directory: `codecrypt/frontend/dist`
5. Click "Deploy site"

## Configuration Files

### netlify.toml
Already created with:
- Build command: `npm run build`
- Publish directory: `dist`
- SPA redirect for client-side routing
- Security headers
- Cache headers for assets

### Build Settings
- Node version: Latest LTS (automatically detected)
- Package manager: npm
- Build command: `npm run build`
- Output directory: `dist`

## Post-Deployment

### Update Backend URL (if needed)
If you need to connect to a backend API, update the proxy configuration in `vite.config.ts` or use environment variables:

```typescript
// In vite.config.ts
server: {
  proxy: {
    '/events': {
      target: process.env.VITE_API_URL || 'http://localhost:3001',
      changeOrigin: true,
    },
  },
}
```

Then set the environment variable in Netlify:
```bash
netlify env:set VITE_API_URL https://your-backend-url.com
```

## Troubleshooting

### Build Fails
- Check build logs in Netlify dashboard
- Ensure all dependencies are in `package.json`
- Try building locally first: `npm run build`

### 404 Errors on Routes
- Verify `netlify.toml` has the SPA redirect rule (already configured)

### Assets Not Loading
- Check that `dist` is the correct publish directory
- Verify asset paths are relative, not absolute

## Demo Features

The deployed frontend includes:
- **Live Metrics Dashboard**: Real-time charts showing resurrection progress
- **AI Narrator**: Audio narration of key events (requires browser speech synthesis)
- **3D Ghost Tour**: Interactive 3D visualization of codebase evolution
- **Resurrection Symphony**: Musical representation of code quality metrics
- **Compilation Status**: Real-time compilation proof display

## Site URL

After deployment, your site will be available at:
- Production: `https://[your-site-name].netlify.app`
- Preview deploys: `https://[deploy-id]--[your-site-name].netlify.app`

## Custom Domain (Optional)

To add a custom domain:
1. Go to Site settings > Domain management
2. Click "Add custom domain"
3. Follow the DNS configuration instructions
