'use strict';

const { spawn } = require('child_process');

/**
 * 独立启动 NSIS 更新安装器，使其在当前 Electron 进程退出后继续运行。
 * @param {string} target 已完成完整性校验的安装器绝对路径。
 * @param {typeof spawn} spawnProcess 子进程创建函数；测试可注入等价实现。
 * @returns {Promise<void>} 安装器进程创建成功时完成，创建失败时拒绝。
 */
function launchUpdateInstaller(target, spawnProcess = spawn) {
  return new Promise((resolve, reject) => {
    const installer = spawnProcess(target, ['--updated'], {
      detached: true,
      stdio: 'ignore',
    });

    /**
     * 将安装器创建失败原样交给调用方，避免播放器在没有安装器时退出。
     * @param {Error} error 子进程创建错误。
     * @returns {void}
     */
    function handleInstallerError(error) {
      installer.removeListener('spawn', handleInstallerSpawn);
      reject(error);
    }

    /**
     * 安装器已拥有独立生命周期后解除句柄引用并允许播放器退出。
     * @returns {void}
     */
    function handleInstallerSpawn() {
      installer.removeListener('error', handleInstallerError);
      installer.unref();
      resolve();
    }

    installer.once('error', handleInstallerError);
    installer.once('spawn', handleInstallerSpawn);
  });
}

module.exports = { launchUpdateInstaller };
