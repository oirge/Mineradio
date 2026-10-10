import { setSuiteChromeCommands } from '../../components/command-palette/commandRegistry';
import { buildSuiteChromeCommands } from '../../components/command-palette/commands/suiteChromeCommands';
import { listLibrarySuites } from '../registry';

// src/library/app/installLibrarySuiteChromeCommands.ts
// 把可用 suite 在 manifest 里声明的外观动作（chromeActions，B2）装进命令面板。命令文件不 import registry，
// 所以由宿主这一层把两边接起来：registry 给清单，命令面板的纯函数生成命令，commandRegistry 检查 id 唯一与
// 执行键无前缀冲突后装入（冲突在这里抛错，启动即暴露）。bootstrap 在渲染前调用一次（只在主窗口，它才有命令面板）。
// 只装本构建可用的 suite（listLibrarySuites 已去掉 available: false 的）；重复调用会替换上一次装入的那批。

export const installLibrarySuiteChromeCommands = (): void => {
    setSuiteChromeCommands(buildSuiteChromeCommands(listLibrarySuites()));
};
