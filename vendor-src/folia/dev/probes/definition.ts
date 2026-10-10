import type React from 'react';
// dev/probes/definition.ts

export interface ProbeDefinition {
    /** URL 里 ?probe= 用的标识，需与文件名保持一致 */
    id: string;
    /** 索引页显示的名字 */
    title: string;
    /** 这个探针要验证什么，写给下一个人看 */
    description: string;
    Component: React.ComponentType;
}
