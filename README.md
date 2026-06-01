# RZN HD Uploader

This project is now prepared for internet deployment with a simple Node.js backend.

## What changed

- `index.html` now uploads the selected video to a server endpoint.
- `server.js` receives the video, runs `ffmpeg` on the backend, and returns the patched output.
- The page is no longer trying to run a local `.bat` file from the browser.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the environment example:
   ```bash
   cp .env.example .env
   ```

3. Set your Supabase values inside `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`

4. Install `ffmpeg` on the server machine and make sure the `ffmpeg` binary is available in `PATH`.

5. Start the server:
   ```bash
   npm start
   ```

6. Open `http://localhost:3000` in your browser.

## Supabase integration

This backend optionally saves upload metadata into a Supabase table called `video_uploads`.

You can create the table with columns like:
- `id` (uuid, primary key)
- `original_name` (text)
- `stored_name` (text)
- `size` (integer)
- `fps` (text)
- `status` (text)
- `error_message` (text)
- `processed_at` (timestamp)

If `.env` is not configured, the app still works locally without Supabase.

## Notes for deployment

- The backend accepts video uploads up to 500MB.
- The server must have `ffmpeg` installed.
- Use a Windows/Node hosting provider if you want to keep the same `ffmpeg` command behavior.
- For public deployment, add HTTPS and proper file cleanup / security hardening.

## Best deployment pattern

For production, the cleanest architecture is:

1. Host the frontend as a static site on Vercel.
2. Host the backend separately on a Node/Express host with `ffmpeg` installed.
3. Send upload requests from the browser to the backend via `/process`.

Recommended setup:

- Keep `API_BASE_URL` blank in `index.html` for local testing.
- On Vercel, use `vercel.json` rewrites to proxy `/process` to your backend.
- Set `CORS_ALLOWED_ORIGINS` on the backend to your Vercel domain.

This is the best way because Vercel is ideal for static UI hosting while the actual video upload and `ffmpeg` processing remain on a dedicated server.

## Docker (recommended)

Use Docker for a reproducible, portable deployment. The provided `Dockerfile` installs `ffmpeg` and runs the Node server.

Build the image:

```bash
docker build -t rzn-hd-uploader .
```

Run the container (map ports and persistent upload/output folders):

Linux / macOS:

```bash
docker run -p 3000:3000 \
   -v $(pwd)/uploads:/usr/src/app/uploads \
   -v $(pwd)/output:/usr/src/app/output \
   rzn-hd-uploader
```

Windows PowerShell:

```powershell
docker run -p 3000:3000 `
   -v ${PWD}/uploads:/usr/src/app/uploads `
   -v ${PWD}/output:/usr/src/app/output `
   rzn-hd-uploader
```

This runs the server with `ffmpeg` available inside the container and keeps uploaded/processed files on your host.

## Deploying with Render (recommended free Docker host)

Render supports Docker-backed web services and provides a public HTTPS URL for your backend. Use the provided `render.yaml` to connect your repo.

1. Create a Render account: https://render.com
2. Connect your GitHub repo or use the Render dashboard to import this repository.
3. Render will detect `render.yaml` and create the web service using `Dockerfile`.
4. Set environment variables in Render:
   - `CORS_ALLOWED_ORIGINS=https://your-vercel-site.vercel.app`
   - `SUPABASE_URL` and `SUPABASE_KEY` if you use Supabase metadata storage
5. Deploy the service and copy the public backend URL.
6. Update `vercel.json` to point `/process` to your Render backend.

Example:

```json
{
  "rewrites": [
    {
      "source": "/process",
      "destination": "https://your-render-backend.onrender.com/process"
    }
  ]
}
```

## docker-compose & Makefile (convenience)

A `docker-compose.yml` and `Makefile` are included for quick local development.

Start the stack (build + run detached):

```bash
make up
```

Stop the stack:

```bash
make down
```

View logs:

```bash
make logs
```

Full rebuild and run:

```bash
make build && make up
```

Clean volumes and local artifacts:

```bash
make clean
```

## Docker Compose quick start

If you prefer using Docker Compose for local development and deployment, run:

```bash
# build the image and start the service
docker compose up --build -d

# view logs
docker compose logs -f

# stop and remove containers
docker compose down
```

The `docker-compose.yml` in this repo maps `./uploads` and `./output` to the container so processed files persist locally.

## Deploy scripts

This repo includes helper scripts under `scripts/` to build, push, and deploy the Docker image to common providers.

- `scripts/build_and_push.sh <image> [tag]` — builds and pushes a Docker image (expects `docker` CLI).
- `scripts/deploy_fly.sh <image> [tag] [fly_app]` — builds/pushes and attempts to deploy to Fly.io using `flyctl` if available.
- `scripts/deploy_do.sh <image> [tag] [do_registry_name] [do_app_id]` — builds/pushes and attempts to trigger a DigitalOcean App update using `doctl` if available.

General flow:

1. Choose a container registry and image name (Docker Hub, GitHub Container Registry, DigitalOcean Container Registry).
2. Run `./scripts/build_and_push.sh myuser/rzn-hd-uploader latest` to build and push.
3. Use the provider-specific script to finish deployment, or configure the provider to pull your image.

Environment tips:

- For Render/other services you can push to Docker Hub and then create a new service on the platform that references that image.
- For Fly.io install `flyctl` and run `scripts/deploy_fly.sh myuser/rzn-hd-uploader latest my-fly-app`.
- For DigitalOcean, use `doctl` with your registry and app ID or push to `registry.digitalocean.com/<name>/...` and update the App via dashboard or CLI.

### Fly.io (recommended)

I recommend Fly.io for this project: it builds from your `Dockerfile`, runs globally if needed, and handles container deployment simply. Use the provided `fly.toml` and the `scripts/deploy_fly.sh` helper.

Quick steps:

```bash
# install flyctl (follow platform-specific instructions)
curl -L https://fly.io/install.sh | sh

# login
flyctl auth login

# create app (or reuse name in fly.toml). Example interactive create:
flyctl launch --name rzn-hd-uploader --region ord

# set secrets (required for Supabase and CORS)
flyctl secrets set SUPABASE_URL=your_url SUPABASE_KEY=your_key CORS_ALLOWED_ORIGINS=https://your-vercel-site.vercel.app

# deploy (builds using Dockerfile)
./scripts/deploy_fly.sh mydockeruser/rzn-hd-uploader latest rzn-hd-uploader

# check app status
flyctl status --app rzn-hd-uploader

# view logs
flyctl logs --app rzn-hd-uploader
```

Notes:
- Fly's file system is ephemeral — uploads are processed during the request and cleaned up; persistent storage should use external object storage if you need to keep files long-term.
- Set `CORS_ALLOWED_ORIGINS` to your Vercel domain so the frontend can call the backend.
