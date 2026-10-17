#!/usr/bin/env bash
# Records working-tree states as git tree objects, so one refactor package's changes can be
# diffed and reviewed without committing, staging, or touching any ref or the real index.
#
# Usage (from anywhere inside the repository):
#   bash .claude/handover/snapshot.sh begin <package-id>   remember the current tree as the package base
#   bash .claude/handover/snapshot.sh diff <package-id>    write <package-id>.patch (base -> now) and print a stat
#   bash .claude/handover/snapshot.sh tree                 print the tree id of the current working tree
#
# Untracked files are included; .gitignore and .git/info/exclude are respected.
# State lives in $REFACTOR_STATE_DIR (default: ${TMPDIR:-/tmp}/hawker-refactor).
set -euo pipefail

mode="${1:-}"
package_id="${2:-}"

repo_root="$(git rev-parse --show-toplevel)"
state_dir="${REFACTOR_STATE_DIR:-${TMPDIR:-/tmp}/hawker-refactor}"
mkdir -p "$state_dir"
cd "$repo_root"

write_tree() {
  export GIT_INDEX_FILE="$state_dir/.snapshot-index"
  git read-tree HEAD
  git add -A
  git write-tree
}

case "$mode" in
  begin)
    write_tree > "$state_dir/$package_id.base"
    echo "Base for $package_id: $(cat "$state_dir/$package_id.base")"
    ;;
  diff)
    base_tree="$(cat "$state_dir/$package_id.base")"
    current_tree="$(write_tree)"
    git diff --binary --find-renames "$base_tree" "$current_tree" > "$state_dir/$package_id.patch"
    git diff --stat --find-renames "$base_tree" "$current_tree" | tail -40
    echo "Patch: $state_dir/$package_id.patch"
    echo "Base tree: $base_tree  Current tree: $current_tree"
    ;;
  tree)
    write_tree
    ;;
  *)
    echo "Usage: snapshot.sh begin|diff <package-id> | tree" >&2
    exit 2
    ;;
esac
