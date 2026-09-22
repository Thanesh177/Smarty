#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
release_dir="$(mktemp -d /private/tmp/smarty-news-learning.XXXXXX)"

zip -j "$release_dir/news.zip" \
  "$project_dir/smarty-terraform/lambda-src/news/lambda_function.py" \
  "$project_dir/infrastructure/shared/generation_cache.py"
zip -j "$release_dir/AIcontent.zip" \
  "$project_dir/infrastructure/ai-content/lambda_function.py" \
  "$project_dir/infrastructure/ai-content/content_catalog.py" \
  "$project_dir/infrastructure/shared/generation_cache.py"
zip -j "$release_dir/generateQuizQuestions.zip" \
  "$project_dir/smarty-terraform/lambda-src/generateQuizQuestions/index.mjs"

printf '\nRelease packages: %s\n' "$release_dir"
