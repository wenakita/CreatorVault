# Fix Vercel Project Configuration

## Issue

The project is currently deployed to the wrong Vercel project (`47-Eagle` / `app.47eagle.com`) when it should be on the `CreatorVault` project (`creatorvault.fun`).

---

## 🔧 Quick Fix

### Step 1: Unlink Current Project

```bash
cd /home/akitav2/projects/CreatorVault
vercel unlink
```

This removes the link to the `47-Eagle` project.

### Step 2: Link to Correct Project

```bash
# Option A: Link to existing CreatorVault project
vercel link

# When prompted:
# ? Set up "~/projects/CreatorVault"? [Y/n] Y
# ? Which scope? → Select your team
# ? Link to existing project? [Y/n] Y
# ? What's the name of your existing project? → creator-vault (or creatorvault)

# Option B: Create new project if needed
vercel link --project=creator-vault
```

### Step 3: Remove Old .vercel Directory

```bash
rm -rf .vercel
```

### Step 4: Re-deploy to Correct Project

```bash
vercel --prod
```

---

## 🎯 Verify Correct Project

After relinking, check that you're deploying to the right place:

```bash
# Check current project
cat .vercel/project.json

# Should show something like:
# {
#   "projectId": "prj_...",
#   "orgId": "team_...",
#   "projectName": "creator-vault"  ← Should be this, not "frontend"
# }
```

---

## 🌐 Domain Configuration

Once deployed to the correct project, ensure the domain is set:

```bash
# Add domain to the correct project
vercel domains add creatorvault.fun --project=creator-vault
```

Or via Vercel Dashboard:
1. Go to https://vercel.com/dashboard
2. Select the correct project (`creator-vault`)
3. Settings → Domains
4. Add `creatorvault.fun`

---

## 🚨 Remove Old Deployment

If the old deployment is still live on `app.47eagle.com`:

### Via Vercel CLI:

```bash
# List projects
vercel projects ls

# Remove deployment from wrong project
vercel remove 47-eagle --yes
```

### Via Vercel Dashboard:

1. Go to https://vercel.com/dashboard
2. Find the `47-Eagle` project
3. Settings → General
4. Scroll to "Delete Project"
5. Or just remove the deployment if you want to keep the project

---

## 📋 Complete Reset (If Needed)

If you want to completely start fresh:

```bash
# 1. Unlink current project
cd /home/akitav2/projects/CreatorVault
vercel unlink

# 2. Remove .vercel directory
rm -rf .vercel

# 3. Create new project with correct name
vercel --prod --project-name=creator-vault

# When prompted:
# ? Set up and deploy? [Y/n] Y
# ? Which scope? → Select your team
# ? Link to existing project? [Y/n] N (create new)
# ? What's your project's name? creator-vault
# ? In which directory is your code located? ./

# 4. Add domain
vercel domains add creatorvault.fun
```

---

## 🔍 Check Current Deployment

To see where things are currently deployed:

```bash
# List all projects
vercel projects ls

# Should show:
# - creator-vault (correct) → creatorvault.fun
# - 47-eagle or frontend (wrong) → app.47eagle.com (remove this)

# List deployments for current directory
vercel ls

# List deployments for specific project
vercel ls --scope=your-team --project=creator-vault
```

---

## ✅ Correct Configuration

After fixing, your setup should be:

```
Project Structure:
/home/akitav2/projects/CreatorVault/
├── .vercel/
│   └── project.json  ← projectName: "creator-vault"
├── vercel.json       ← Build config
└── frontend/         ← Source code

Vercel Project:
- Name: creator-vault (or creatorvault)
- Domain: creatorvault.fun
- Framework: Vite
- Root Directory: ./
- Output Directory: frontend/dist

Deployment:
- Production: https://creatorvault.fun
- Preview: https://creator-vault-*.vercel.app
```

---

## 🎯 Summary

**The issue:** Deployed to `47-Eagle` project (`app.47eagle.com`)  
**The fix:** Unlink, relink to `creator-vault` project  
**The result:** Deploy to `creatorvault.fun`

**Quick commands:**
```bash
cd /home/akitav2/projects/CreatorVault
vercel unlink
rm -rf .vercel
vercel link --project=creator-vault
vercel --prod
```

---

## 📞 Need Help?

If the project name doesn't exist yet:
```bash
# Create it via dashboard first or let CLI create it
vercel --prod
# → Select "Create new project"
# → Name it "creator-vault"
```

If domain issues persist:
```bash
# Check domain status
vercel domains ls

# Inspect DNS
vercel domains inspect creatorvault.fun
```

---

**After fixing, the CreatorVault app will be at `creatorvault.fun`, not `app.47eagle.com`!** ✅

