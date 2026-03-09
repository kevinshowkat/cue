#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
parent_dir="$(cd "${repo_root}/.." && pwd)"
base_ref="${1:-feature/design-wave-integration}"

worktrees=(
  "juggernaut-apple-coordinator:feature/apple-polish-coordination"
  "juggernaut-apple-chrome:feature/apple-chrome-structure"
  "juggernaut-apple-surface:feature/apple-surface-reset"
  "juggernaut-apple-runtime:feature/apple-runtime-minimalism"
  "juggernaut-apple-rail:feature/apple-rail-controls"
  "juggernaut-apple-native:feature/apple-native-window-polish"
)

echo "[juggernaut-apple] repo_root=${repo_root}"
echo "[juggernaut-apple] base_ref=${base_ref}"

git -C "${repo_root}" rev-parse --verify "${base_ref}" >/dev/null

for entry in "${worktrees[@]}"; do
  dir_name="${entry%%:*}"
  branch_name="${entry##*:}"
  worktree_path="${parent_dir}/${dir_name}"

  if [[ -e "${worktree_path}" ]]; then
    echo "[juggernaut-apple] skip existing ${worktree_path}"
    continue
  fi

  echo "[juggernaut-apple] creating ${worktree_path} on ${branch_name}"
  git -C "${repo_root}" worktree add "${worktree_path}" -b "${branch_name}" "${base_ref}"
done

echo "[juggernaut-apple] active worktrees:"
git -C "${repo_root}" worktree list
