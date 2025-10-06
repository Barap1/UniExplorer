# UniExplorer - Vercel Deployment Guide

## 🚀 Quick Deployment Steps

### Option 1: Deploy via Vercel Web Interface (Easiest)

1. **Push your code to GitHub** (if not already done):
   ```bash
   cd /home/barap/UniExplorer
   git add .
   git commit -m "Ready for Vercel deployment"
   git push origin main
   ```

2. **Go to Vercel**:
   - Visit [vercel.com](https://vercel.com)
   - Sign in with your GitHub account

3. **Import Project**:
   - Click "Add New..." → "Project"
   - Select your `UniExplorer` repository
   - Click "Import"

4. **Configure Project**:
   - **Framework Preset**: Vite
   - **Root Directory**: `uniexplorer` (important!)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

5. **Deploy**:
   - Click "Deploy"
   - Wait 1-2 minutes for the build to complete
   - Your site will be live at `https://your-project-name.vercel.app`

---

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy from the project directory**:
   ```bash
   cd /home/barap/UniExplorer/uniexplorer
   vercel
   ```

4. **Follow the prompts**:
   - Set up and deploy? **Y**
   - Which scope? Select your account
   - Link to existing project? **N** (first time)
   - What's your project's name? `uniexplorer`
   - In which directory is your code located? `./`
   - Want to override the settings? **N**

5. **Deploy to production**:
   ```bash
   vercel --prod
   ```

---

## ⚙️ Important Configuration

### Firebase Configuration (Already Set Up)
Your Firebase config is already hardcoded in `src/firebaseConfig.ts`, so no environment variables are needed. The app will work immediately after deployment!

### Firebase Console Setup (Important!)
You need to add your Vercel domain to Firebase's authorized domains:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: `uniexplorer-7e2bc`
3. Go to **Authentication** → **Settings** → **Authorized domains**
4. Click **Add domain**
5. Add your Vercel URL (e.g., `uniexplorer.vercel.app`)
6. Save

Without this, Google Sign-In will fail on the deployed site!

---

## 📁 Project Structure

The build process expects this structure:
```
UniExplorer/
└── uniexplorer/          ← Root directory for Vercel
    ├── package.json
    ├── vite.config.ts
    ├── vercel.json       ← Created (SPA routing)
    ├── .vercelignore     ← Created (excludes files)
    ├── src/
    ├── public/
    └── dist/             ← Build output
```

---

## 🔧 Files Created

### `vercel.json`
Ensures proper routing for single-page application:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### `.vercelignore`
Excludes unnecessary files from deployment:
```
node_modules
.git
.env.local
.env*.local
dist
```

---

## ✅ Pre-Deployment Checklist

- [x] ✅ Build completes successfully (`npm run build`)
- [x] ✅ Firebase config is in place
- [x] ✅ Vercel config files created
- [x] ✅ Project structure is correct
- [ ] ⏳ Push code to GitHub
- [ ] ⏳ Deploy to Vercel
- [ ] ⏳ Add Vercel domain to Firebase authorized domains
- [ ] ⏳ Test Google Sign-In on deployed site

---

## 🐛 Troubleshooting

### Build fails on Vercel
- Make sure **Root Directory** is set to `uniexplorer`
- Verify **Build Command** is `npm run build`
- Check **Output Directory** is `dist`

### Google Sign-In doesn't work
- Add your Vercel domain to Firebase authorized domains (see above)
- Wait 5-10 minutes for Firebase changes to propagate

### Map doesn't load
- Check browser console for errors
- Ensure Leaflet CSS is loading (it's via CDN in index.html)

### Firestore permissions error
- Make sure Firebase Firestore rules allow authenticated users to read/write

---

## 🎉 After Deployment

Your UniExplorer app will be live at:
- Production: `https://uniexplorer.vercel.app` (or your custom domain)
- Automatic deployments on every git push to main
- Preview deployments for pull requests

### Next Steps:
1. Test all features:
   - ✅ Google Sign-In
   - ✅ Create annotations
   - ✅ View leaderboard
   - ✅ Switch celestial bodies
   - ✅ Filter annotations

2. Optional: Add a custom domain in Vercel settings

3. Share your space exploration app! 🚀🌌

---

## 📊 Build Info

- **Framework**: Vite + React + TypeScript
- **Size**: ~678KB (minified + gzipped: ~175KB)
- **Build Time**: ~1-2 seconds
- **Deployment Time**: ~1-2 minutes

---

## 🔗 Useful Links

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Vercel Documentation](https://vercel.com/docs)
- [Firebase Console](https://console.firebase.google.com)
- [Your Firebase Project](https://console.firebase.google.com/project/uniexplorer-7e2bc)

---

Good luck with your deployment! 🌟
