#!/usr/bin/env bash

set -euo pipefail

app_id="${1:-}"
branch_name="${2:-}"
artifact_path="${3:-}"

if [[ -z "$app_id" || -z "$branch_name" || -z "$artifact_path" ]]; then
  echo "Usage: $0 <amplify-app-id> <branch-name> <artifact.zip>" >&2
  exit 2
fi

if [[ ! -f "$artifact_path" ]]; then
  echo "Deployment artifact not found: $artifact_path" >&2
  exit 2
fi

if [[ "$branch_name" != "staging" && "$branch_name" != "production" ]]; then
  echo "Only staging and production deployments are allowed." >&2
  exit 2
fi

read -r job_id upload_url <<< "$(
  aws amplify create-deployment \
    --app-id "$app_id" \
    --branch-name "$branch_name" \
    --query '[jobId,zipUploadUrl]' \
    --output text
)"

if [[ -z "$job_id" || -z "$upload_url" ]]; then
  echo "Amplify did not return a deployment job and upload URL." >&2
  exit 1
fi

curl --fail --silent --show-error --upload-file "$artifact_path" "$upload_url"

aws amplify start-deployment \
  --app-id "$app_id" \
  --branch-name "$branch_name" \
  --job-id "$job_id" \
  >/dev/null

echo "Amplify deployment $job_id started for $branch_name."

for attempt in {1..90}; do
  status="$(
    aws amplify get-job \
      --app-id "$app_id" \
      --branch-name "$branch_name" \
      --job-id "$job_id" \
      --query 'job.summary.status' \
      --output text
  )"

  case "$status" in
    SUCCEED)
      echo "Amplify deployment $job_id succeeded."
      exit 0
      ;;
    FAILED|CANCELLED)
      echo "Amplify deployment $job_id ended with status $status." >&2
      exit 1
      ;;
    PENDING|PROVISIONING|RUNNING|CANCELLING)
      sleep 5
      ;;
    *)
      echo "Unexpected Amplify deployment status: $status" >&2
      exit 1
      ;;
  esac
done

echo "Timed out waiting for Amplify deployment $job_id." >&2
exit 1
