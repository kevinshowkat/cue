#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
parent_dir="$(cd "${repo_root}/.." && pwd)"
base_ref="${1:-feature/launch-slice-integration}"

worktrees=(
  "juggernaut-design-coordinator:feature/design-wave-coordination"
  "juggernaut-design-layout:feature/design-shell-layout"
  "juggernaut-design-visual:feature/design-visual-system"
  "juggernaut-design-runtime:feature/design-runtime-debrood"
  "juggernaut-design-icons:feature/design-iconography"
  "juggernaut-design-native:feature/design-native-glass-spike"
)

echo "[juggernaut-design] repo_root=${repo_root}"
echo "[juggernaut-design] base_ref=${base_ref}"

git -C "${repo_root}" rev-parse --verify "${base_ref}" >/dev/null

for entry in "${worktrees[@]}"; do
  dir_name="${entry%%:*}"
  branch_name="${entry##*:}"
  worktree_path="${parent_dir}/${dir_name}"

  if [[ -e "${worktree_path}" ]]; then
    echo "[juggernaut-design] skip existing ${worktree_path}"
    continue
  fi

  echo "[juggernaut-design] creating ${worktree_path} on ${branch_name}"
  git -C "${repo_root}" worktree add "${worktree_path}" -b "${branch_name}" "${base_ref}"
done

echo "[juggernaut-design] active worktrees:"
git -C "${repo_root}" worktree list
