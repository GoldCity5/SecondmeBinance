#!/bin/bash
set -e
cd "$(dirname "$0")/.."
mkdir -p logs
npx next build 2>&1 | tee logs/build.log
