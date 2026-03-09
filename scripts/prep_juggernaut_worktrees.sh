#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
parent_dir="$(cd "${repo_root}/.." && pwd)"

worktrees=(
  "${parent_dir}/juggernaut-shell"
  "${parent_dir}/juggernaut-tools"
  "${parent_dir}/juggernaut-edit"
  "${parent_dir}/juggernaut-export"
  "${parent_dir}/juggernaut-icons"
)

for worktree_path in "${worktrees[@]}"; do
  desktop_path="${worktree_path}/desktop"
  if [[ ! -d "${desktop_path}" ]]; then
    echo "[juggernaut] skip missing ${desktop_path}"
    continue
  fi

  echo "[juggernaut] npm install in ${desktop_path}"
  (
    cd "${desktop_path}"
    npm install
  )
done

echo "[juggernaut] prep complete"
