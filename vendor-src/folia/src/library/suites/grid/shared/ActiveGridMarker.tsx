import React, { useEffect } from 'react';
import { useIsPresent } from 'framer-motion';
import { ACTIVE_GRID_ATTR } from '../transitions/gridMorphContract';

// src/library/suites/grid/shared/ActiveGridMarker.tsx
// 把「我是不是当前那一层网格」写成 DOM 属性，供移形换影的测量读取。
//
// 为什么是一个 5 行的子组件，而不是在 GridView / ArtistGridView 的根节点上直接调
// useIsPresent()：那两个组件都是上千行的树（几十张卡片、每张都有图片和按钮），而
// presence 上下文恰好在**退出动画开始的那一帧**翻转 —— 在根节点订阅它，整个网格会在最不
// 该掉帧的时刻重渲染一次。订阅关在这里之后，翻转只重渲染这个返回 null 的组件，属性通过
// 命令式写入现有的根 ref，DOM 上不多一个盒子、布局不变。
//
// 属性放在卡片容器而不是根节点上也一样成立：探针只在它的子树里找卡片。

interface ActiveGridMarkerProps {
    /** 该网格的根（或包含全部卡片的容器）元素。 */
    target: React.RefObject<HTMLElement | null>;
}

const ActiveGridMarker: React.FC<ActiveGridMarkerProps> = ({ target }) => {
    const isPresent = useIsPresent();

    useEffect(() => {
        const el = target.current;
        if (!el) {
            return;
        }
        if (isPresent) {
            el.setAttribute(ACTIVE_GRID_ATTR, '');
        } else {
            el.removeAttribute(ACTIVE_GRID_ATTR);
        }
    }, [isPresent, target]);

    return null;
};

export default ActiveGridMarker;
