#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
release_dir="$(mktemp -d /private/tmp/smarty-post-vocabulary.XXXXXX)"
api_dir="$release_dir/api"
worker_dir="$release_dir/worker"
mkdir -p "$api_dir" "$worker_dir"

# The same absolute Makefile path is used by SAM's custom-make builder, even
# when its working directory is a scratch folder. No runtime dependencies or
# unrelated publisher code are included in these packages.
make --silent --makefile "$project_dir/infrastructure/post-vocabulary/Makefile" \
  build-ApiFunction "ARTIFACTS_DIR=$api_dir"
make --silent --makefile "$project_dir/infrastructure/post-vocabulary/Makefile" \
  build-WorkerFunction "ARTIFACTS_DIR=$worker_dir"
zip -jq "$release_dir/vocabulary-api.zip" "$api_dir/api.py" "$api_dir/common.py" "$api_dir/post_glossary.py"
zip -jq "$release_dir/vocabulary-worker.zip" "$worker_dir/worker.py" "$worker_dir/common.py" "$worker_dir/post_glossary.py"
shasum -a 256 "$release_dir/vocabulary-api.zip" "$release_dir/vocabulary-worker.zip"
printf '\nLocal vocabulary packages: %s\n' "$release_dir"
