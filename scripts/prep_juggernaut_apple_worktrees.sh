#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
parent_dir="$(cd "${repo_root}/.." && pwd)"

worktrees=(
  "${parent_dir}/juggernaut-apple-chrome"
  "${parent_dir}/juggernaut-apple-surface"
  "${parent_dir}/juggernaut-apple-runtime"
  "${parent_dir}/juggernaut-apple-rail"
  "${parent_dir}/juggernaut-apple-native"
)

for worktree_path in "${worktrees[@]}"; do
  desktop_path="${worktree_path}/desktop"
  if [[ ! -d "${desktop_path}" ]]; then
    echo "[juggernaut-apple] skip missing ${desktop_path}"
    continue
  fi

  echo "[juggernaut-apple] npm install in ${desktop_path}"
  (
    cd "${desktop_path}"
    npm install
  )
done

echo "[juggernaut-apple] prep complete"
