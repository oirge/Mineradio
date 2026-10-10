import { useEffect, useState } from 'react';

// src/hooks/useOneTimeHint.ts
// 一次性引导提示：某个 key 第一次被使用时返回 true，并把"已展示"写进 localStorage，
// 之后同一个 key 不再提示。localStorage 不可用时（隐私模式、非浏览器环境）静默降级为不提示，
// 避免每次进入视图都重复打扰。

const hasSeenHint = (key: string): boolean => {
    try {
        return localStorage.getItem(key) === '1';
    } catch {
        return true;
    }
};

export const useOneTimeHint = (key: string): boolean => {
    const [shouldHint] = useState(() => !hasSeenHint(key));

    useEffect(() => {
        if (!shouldHint) return;
        try {
            localStorage.setItem(key, '1');
        } catch {
            // 写不进去就只在本次会话提示一次，不影响功能
        }
    }, [key, shouldHint]);

    return shouldHint;
};

export default useOneTimeHint;
