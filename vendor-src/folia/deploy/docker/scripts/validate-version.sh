#!/bin/sh
set -eu

# 当前文件：校验 Docker 稳定版本，并可验证版本相对上一版本递增。
version_file="${1:-deploy/docker/VERSION}"
previous_version="${2:-}"
version="$(tr -d '[:space:]' < "$version_file")"

if ! printf '%s' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "$version_file must contain a stable A.B.C version, got: $version" >&2
  exit 1
fi

if [ -n "$previous_version" ]; then
  previous_version="$(printf '%s' "$previous_version" | tr -d '[:space:]')"
  if ! printf '%s' "$previous_version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "Previous version is invalid: $previous_version" >&2
    exit 1
  fi
  highest="$(printf '%s\n%s\n' "$previous_version" "$version" | sort -V | tail -n 1)"
  if [ "$highest" != "$version" ] || [ "$version" = "$previous_version" ]; then
    echo "Version $version must be greater than $previous_version" >&2
    exit 1
  fi
fi

printf '%s\n' "$version"
