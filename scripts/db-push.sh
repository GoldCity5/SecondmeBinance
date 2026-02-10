#!/bin/bash
set -e
cd "$(dirname "$0")/.."
npx prisma db push
npx prisma generate
