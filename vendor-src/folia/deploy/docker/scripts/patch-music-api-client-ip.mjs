import fs from 'node:fs';

// 当前文件：限制 Docker 音乐 API 将浏览器或容器私网地址伪装成音乐平台请求来源。
const provider = process.argv[2];
const patches = {
  netease: {
    file: 'node_modules/@neteasecloudmusicapienhanced/api/server.js',
    before: `          if (options.randomCNIP) {
            ip = global.cnIp
          } else {
            ip = req.ip
`,
    after: `          if (options.randomCNIP) {
            ip = global.cnIp
          } else if (process.env.FOLIA_FORWARD_CLIENT_IP === 'true') {
            ip = req.ip
`,
  },
  kugou: {
    file: 'node_modules/kugoumusicapi/server.js',
    before: '          let ip = req.ip;\n',
    after: "          let ip = process.env.FOLIA_FORWARD_CLIENT_IP === 'true' ? req.ip : '';\n",
  },
};

const patch = patches[provider];
if (!patch) {
  throw new Error(`Unsupported music API provider: ${provider || '(missing)'}`);
}

const source = fs.readFileSync(patch.file, 'utf8');
const matchCount = source.split(patch.before).length - 1;
if (matchCount !== 1) {
  throw new Error(`Expected one client IP patch target in ${patch.file}, found ${matchCount}`);
}

fs.writeFileSync(patch.file, source.replace(patch.before, patch.after));
console.log(`Disabled implicit client IP forwarding for ${provider}`);
