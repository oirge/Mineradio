#!/bin/sh
set -eu

# 当前文件：校验运行时 provider 并生成只写入临时目录的 Nginx 配置。
case "${FOLIA_AI_PROVIDER:-google}" in
  google|gemini)
    FOLIA_AI_PROVIDER=gemini
    ;;
  openai)
    FOLIA_AI_PROVIDER=openai
    ;;
  *)
    echo "FOLIA_AI_PROVIDER must be google, gemini, or openai" >&2
    exit 1
    ;;
esac

# 默认放行的“局域网”来源：回环、RFC 1918、CGNAT（Tailscale 等组网用的 100.64/10）、链路本地，以及对应的 IPv6。
PRIVATE_RANGES='127.0.0.0/8 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 100.64.0.0/10 169.254.0.0/16 ::1 fc00::/7 fe80::/10'

# 逐项校验 IP/CIDR 后输出 "<directive> <addr>;"。值会原样写进 nginx 配置，只允许地址字符，杜绝注入。
# 第四个参数为 allow-private 时才接受 private 关键字。
render_address_list() {
  directive=$1
  name=$2
  list=$3
  private_mode=${4:-}
  out=''
  for addr in $(printf '%s' "$list" | tr ',' ' '); do
    if [ "$addr" = private ]; then
      if [ "$private_mode" != allow-private ]; then
        echo "$name does not accept 'private'; list the exact proxy addresses" >&2
        exit 1
      fi
      for range in $PRIVATE_RANGES; do out="$out $directive $range;"; done
      continue
    fi
    case "$addr" in
      *[!0-9A-Fa-f:./]*)
        echo "$name contains an invalid address: $addr" >&2
        exit 1
        ;;
    esac
    out="$out $directive $addr;"
  done
  printf '%s' "$out"
}

# /api/navidrome-preset 会下发明文密码，默认只给局域网来源。any 表示不限制。
NAVIDROME_PRESET_ALLOW=${NAVIDROME_PRESET_ALLOW:-private}
if [ "$NAVIDROME_PRESET_ALLOW" = any ]; then
  FOLIA_NAVIDROME_PRESET_ACL='allow all;'
else
  FOLIA_NAVIDROME_PRESET_ACL="$(render_address_list allow NAVIDROME_PRESET_ALLOW "$NAVIDROME_PRESET_ALLOW" allow-private) deny all;"
  if [ "$FOLIA_NAVIDROME_PRESET_ACL" = ' deny all;' ]; then
    echo "NAVIDROME_PRESET_ALLOW must list at least one address, or be 'private' / 'any'" >&2
    exit 1
  fi
fi

# 前面还有一层反向代理时，nginx 看到的来源是代理自己（往往是局域网地址），白名单形同虚设。
# 列出代理地址后，只信任它们追加的 X-Forwarded-For，从中还原真实来源。
# 不接受 private：userland-proxy 下所有来源都是 172.x，整段信任等于让客户端自填 XFF 冒充局域网。
FOLIA_REAL_IP_CONFIG=''
if [ -n "${FOLIA_TRUSTED_PROXIES:-}" ]; then
  FOLIA_REAL_IP_CONFIG="$(render_address_list set_real_ip_from FOLIA_TRUSTED_PROXIES "$FOLIA_TRUSTED_PROXIES") real_ip_header X-Forwarded-For; real_ip_recursive on;"
fi

export FOLIA_AI_PROVIDER FOLIA_NAVIDROME_PRESET_ACL FOLIA_REAL_IP_CONFIG
envsubst '${FOLIA_AI_PROVIDER} ${FOLIA_NAVIDROME_PRESET_ACL} ${FOLIA_REAL_IP_CONFIG}' < /etc/nginx/nginx.conf.template > /tmp/nginx.conf
exec nginx -c /tmp/nginx.conf -g 'daemon off;'
