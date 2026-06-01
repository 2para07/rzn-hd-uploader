#!/usr/bin/env bash
set -euo pipefail

# deploy_fly.sh
# Usage: ./scripts/deploy_fly.sh <image> [tag] [fly_app]
# If flyctl is installed and <fly_app> exists, this will deploy the provided image.

IMAGE="$1"
TAG="${2:-latest}"
APP="${3:-}" # optional fly app name
FULL="${IMAGE}:${TAG}"

# Build & push helper
if ! command -v docker >/dev/null 2>&1; then
  echo "docker CLI not found. Install Docker to build/push images." >&2
  exit 1
fi

./scripts/build_and_push.sh "${IMAGE}" "${TAG}"

if command -v flyctl >/dev/null 2>&1; then
  if [ -n "${APP}" ]; then
    echo "Deploying ${FULL} to Fly app ${APP} using flyctl..."
    flyctl deploy --app "${APP}" --image "${FULL}"
  else
    echo "No Fly app name supplied. To create one interactively run: flyctl launch"
    echo "Or run this script with a Fly app name to deploy: ./scripts/deploy_fly.sh ${IMAGE} ${TAG} my-fly-app"
  fi
else
  echo "flyctl not found. Manual instructions:"
  echo "1) Create a Fly app: https://fly.io/docs/reference/cli/ - 'flyctl launch'"
  echo "2) Deploy the pushed image: 'flyctl deploy --app <app-name> --image ${FULL}'"
fi

echo "Done."