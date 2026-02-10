#!/bin/bash
set -e
cd "$(dirname "$0")/.."
mkdir -p logs
npx next dev 2>&1 | tee logs/dev.log
