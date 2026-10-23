#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Ensure dependencies & build are present
if [ ! -d "$DIR/dist" ] || [ ! -d "$DIR/dist-electron" ]; then
  echo "Building HUSK for macOS..."
  PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH" pnpm build:all
fi

# Launch HUSK Electron Desktop App
PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH" electron .
