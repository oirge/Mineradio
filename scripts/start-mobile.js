'use strict';

const os = require('node:os');

process.env.HOST = process.env.HOST || '0.0.0.0';
process.env.PORT = process.env.PORT || '3000';
require('../server.js');

console.log('\n手机和电脑连接同一 Wi-Fi 后，在手机浏览器打开：');
for (const addresses of Object.values(os.networkInterfaces())) {
  for (const address of addresses || []) {
    if (address.family === 'IPv4' && !address.internal) {
      console.log(`  http://${address.address}:${process.env.PORT}`);
    }
  }
}
console.log('选择「本地文件」导入手机中的音乐。按 Ctrl+C 停止服务。\n');
