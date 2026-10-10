import React from 'react';
import { hideAppSplash } from '../utils/appSplash';

// src/components/AppSplashGate.tsx
// 包在根组件树外层：首帧挂载完成后（useEffect 在浏览器绘制之后触发）移除首屏加载遮罩，
// 保证遮罩淡出时下面已经是渲染好的界面，而不是空白。

const AppSplashGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    React.useEffect(() => {
        hideAppSplash();
    }, []);

    return <>{children}</>;
};

export default AppSplashGate;
