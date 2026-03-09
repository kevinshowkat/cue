#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
parent_dir="$(cd "${repo_root}/.." && pwd)"
base_ref="${1:-feature/juggernaut-bootstrap}"

worktrees=(
  "juggernaut-coordinator:feature/coordination"
  "juggernaut-shell:feature/shell-canvas"
  "juggernaut-tools:feature/tool-runtime"
  "juggernaut-edit:feature/photo-edit"
  "juggernaut-export:feature/export-psd"
  "juggernaut-icons:feature/iconography"
)

echo "[juggernaut] repo_root=${repo_root}"
echo "[juggernaut] base_ref=${base_ref}"

git -C "${repo_root}" rev-parse --verify "${base_ref}" >/dev/null

for entry in "${worktrees[@]}"; do
  dir_name="${entry%%:*}"
  branch_name="${entry##*:}"
  worktree_path="${parent_dir}/${dir_name}"

  if [[ -e "${worktree_path}" ]]; then
    echo "[juggernaut] skip existing ${worktree_path}"
    continue
  fi

  echo "[juggernaut] creating ${worktree_path} on ${branch_name}"
  git -C "${repo_root}" worktree add "${worktree_path}" -b "${branch_name}" "${base_ref}"
done

echo "[juggernaut] active worktrees:"
git -C "${repo_root}" worktree list
