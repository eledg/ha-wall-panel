#!/usr/bin/env bash
# Fails when SonarCloud reports any unresolved issue on new code.
# Needs SONAR_TOKEN; PR_NUMBER is set for pull requests, empty for pushes to main.
set -euo pipefail

api="https://sonarcloud.io/api"
report=".scannerwork/report-task.txt"
project_key=$(sed -n 's/^sonar.projectKey=//p' sonar-project.properties)

get() { curl --proto '=https' --tlsv1.2 -fsSL -u "$SONAR_TOKEN:" "$@"; }

ce_task_url=$(sed -n 's/^ceTaskUrl=//p' "$report")
for _ in $(seq 1 60); do
  status=$(get "$ce_task_url" | jq -r .task.status)
  case "$status" in
    SUCCESS) break ;;
    FAILED | CANCELED)
      echo "::error::SonarCloud analysis $status"
      exit 1
      ;;
    *) ;; # still queued or running
  esac
  sleep 5
done
if [[ "$status" != "SUCCESS" ]]; then
  echo "::error::Timed out waiting for the SonarCloud analysis"
  exit 1
fi

scope=(--data-urlencode "branch=main")
link_scope="branch=main"
if [[ -n "${PR_NUMBER:-}" ]]; then
  scope=(--data-urlencode "pullRequest=$PR_NUMBER")
  link_scope="pullRequest=$PR_NUMBER"
fi

total=$(get -G "$api/issues/search" \
  --data-urlencode "componentKeys=$project_key" \
  --data-urlencode "inNewCodePeriod=true" \
  --data-urlencode "resolved=false" \
  --data-urlencode "ps=1" \
  "${scope[@]}" | jq -r .paging.total)

if [[ "$total" -gt 0 ]]; then
  echo "::error::SonarCloud found $total new issue(s): https://sonarcloud.io/project/issues?id=$project_key&$link_scope&inNewCodePeriod=true&resolved=false"
  exit 1
fi
echo "No new SonarCloud issues"
