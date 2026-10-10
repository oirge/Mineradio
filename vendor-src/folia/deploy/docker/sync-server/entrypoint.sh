#!/bin/sh
set -eu

# 当前文件：准备同步数据库挂载目录，然后以非 root 用户运行服务。
chown node:node /app/data
exec su-exec node node /app/dist/node.js
