#!/bin/bash

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <node_version>"
  exit 1
fi

NODE_VERSION="$1"
ARCH="armv7l"
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

if pgrep -x "node" >/dev/null; then
  echo "Node.js is currently running!"
  exit 1
fi

NODE_TARBALL="node-$NODE_VERSION-linux-$ARCH.tar.gz"
DOWNLOAD_URL="https://nodejs.org/download/release/$NODE_VERSION/$NODE_TARBALL"

echo "Downloading Node.js $NODE_VERSION for $ARCH..."
if ! curl -fL -o "$TEMP_DIR/$NODE_TARBALL" "$DOWNLOAD_URL"; then
  echo "Error: Failed to download $NODE_TARBALL" >&2
  exit 1
fi

echo "Extracting $NODE_TARBALL..."
tar -xzf "$TEMP_DIR/$NODE_TARBALL" -C "$TEMP_DIR"

NODE_DIR="$TEMP_DIR/node-$NODE_VERSION-linux-$ARCH"
echo "Installing Node.js..."
sudo cp -R "$NODE_DIR"/* /usr/local/

echo "Node.js installation completed:"
node -v
