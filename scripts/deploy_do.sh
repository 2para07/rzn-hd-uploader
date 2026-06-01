#!/usr/bin/env bash
set -euo pipefail

# deploy_do.sh
# Usage: ./scripts/deploy_do.sh <image> [tag] [do_registry_name] [do_app_id]
# Example: ./scripts/deploy_do.sh registry.digitalocean.com/my-registry/rzn-hd-uploader latest my-registry <APP_ID>

IMAGE="$1"
TAG="${2:-latest}"
REGISTRY_NAME="${3:-}" # e.g. registry.digitalocean.com/my-registry
APP_ID="${4:-}"
FULL="${IMAGE}:${TAG}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker CLI not found. Install Docker to build/push images." >&2
  exit 1
fi

# If registry name not provided, assume IMAGE already includes registry
if [ -n "${REGISTRY_NAME}" ]; then
  echo "Tagging image for DigitalOcean registry: ${REGISTRY_NAME}/${IMAGE##*/}:${TAG}"
  docker build -t "${REGISTRY_NAME}/${IMAGE##*/}:${TAG}" .
  docker push "${REGISTRY_NAME}/${IMAGE##*/}:${TAG}"
  DEPLOY_IMAGE="${REGISTRY_NAME}/${IMAGE##*/}:${TAG}"
else
  echo "Pushing image ${FULL}"
  docker build -t "${FULL}" .
  docker push "${FULL}"
  DEPLOY_IMAGE="${FULL}"
fi

if command -v doctl >/dev/null 2>&1; then
  if [ -n "${APP_ID}" ]; then
    echo "Triggering deployment for app ${APP_ID} with image ${DEPLOY_IMAGE}"
    # create a spec that updates the image - simplest approach is to create a deployment via doctl
    doctl apps update "${APP_ID}" --image "${DEPLOY_IMAGE}"
    echo "doctl update requested. Check DigitalOcean dashboard for progress."
  else
    echo "No DigitalOcean App ID provided. You can create/update an app in the dashboard using image: ${DEPLOY_IMAGE}"
  fi
else
  echo "doctl not found. Manual steps to deploy on DigitalOcean App Platform:" 
  echo "1) Push image to DigitalOcean Container Registry or Docker Hub: ${DEPLOY_IMAGE}"
  echo "2) Create or update an App on DigitalOcean and point it to the container image above."
fi

echo "Done."