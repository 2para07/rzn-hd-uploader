#!/usr/bin/env bash
set -euo pipefail

# build_and_push.sh
# Usage: ./scripts/build_and_push.sh <image> [tag]
# Example: ./scripts/build_and_push.sh mydockeruser/rzn-hd-uploader latest

IMAGE="$1"
TAG="${2:-latest}"
FULL="${IMAGE}:${TAG}"

echo "Building Docker image ${FULL}..."
docker build -t "${FULL}" .

echo "Pushing ${FULL} to registry..."
docker push "${FULL}"

echo "Done: ${FULL}"