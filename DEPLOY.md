# PCG Platform v5.0 — Deploy to Render.com

## Quick Deploy (5 minutes)

```bash
# 1. Extract the tarball
tar xzf pcg-platform-v5.0-render-ready.tar.gz
cd pcg-platform-main

# 2. Init git and push to GitHub
git init
git add -A
git commit -m "PCG Platform v5.0"
git remote add origin https://github.com/YOUR_USERNAME/pcg-platform.git
git branch -M main
git push -u origin main

# 3. Go to Render Dashboard → New + → Blueprint → Select your repo → Apply
# Render auto-provisions: pcg-db + pcg-api + pcg-web
# Wait 3-5 minutes for builds

# 4. Test
curl https://pcg-api.onrender.com/health
# Should return: {"status":"ok","checks":{"database":"ok"}}
```

## If replacing existing repo

```bash
git clone https://github.com/YOUR_USERNAME/pcg-platform.git
cd pcg-platform
find . -maxdepth 1 ! -name '.git' ! -name '.' -exec rm -rf {} +
tar xzf ~/Downloads/pcg-platform-v5.0-render-ready.tar.gz --strip-components=1
git add -A
git commit -m "v5.0 - all fixes applied"
git push origin main
```

## After Deploy — CORS Check

If service names have suffixes (e.g. `pcg-web-abc123`):

1. Go to Render Dashboard → pcg-api → Environment
2. Set `CORS_ORIGINS` = `https://pcg-web-abc123.onrender.com` (exact URL, no trailing slash)
3. Go to pcg-web → Environment  
4. Set `NEXT_PUBLIC_API_URL` = `https://pcg-api-abc123.onrender.com/api/v1`
5. Trigger manual deploy on pcg-web (NEXT_PUBLIC_API_URL is baked at build time)

## 22 GCP Services

| Category | Services |
|----------|----------|
| Compute | Compute Engine, GKE, Cloud Run, Cloud Functions |
| Storage & Data | Cloud Storage, Cloud SQL, Memorystore, BigQuery |
| Messaging | Pub/Sub, Dataflow |
| AI & ML | Vertex AI (Models + Endpoints) |
| Networking | VPC, Load Balancers, Cloud DNS, API Gateway |
| Security | IAM, Secret Manager, KMS, Cloud Armor |
| CI/CD | Cloud Build, Artifact Registry, Cloud Scheduler |
| Operations | Cloud Monitoring (Alerts + Uptime), Activity Log |
