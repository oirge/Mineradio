import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { List as VirtualList, type RowComponentProps } from 'react-window';
import type { GridMapItem } from './GridMap';

// src/library/suites/grid/directory/GridMapBatchItemList.tsx
// Renders the flat virtual selector used by local album and artist GridMaps.

interface GridMapBatchItemListProps {
    items: GridMapItem[];
    /** 选中的条目 id（目录会话里的批选）。 */
    selectedItemIds: ReadonlySet<string>;
    onSetItemsSelected: (itemIds: string[], selected: boolean) => void;
}

interface ItemRowProps extends GridMapBatchItemListProps {}

const ItemRow = ({
    index,
    style,
    ariaAttributes,
    items,
    selectedItemIds,
    onSetItemsSelected,
}: RowComponentProps<ItemRowProps>) => {
    const { t } = useTranslation();
    const item = items[index];
    const itemId = String(item.id);
    const selected = selectedItemIds.has(itemId);
    const trackCount = item.trackIds?.length || 0;

    return (
        <div {...ariaAttributes} style={style} className="px-1 py-0.5">
            <button
                type="button"
                onClick={() => onSetItemsSelected([itemId], !selected)}
                className="flex h-full w-full items-center gap-3 rounded-xl px-3 text-left transition hover:bg-black/5 dark:hover:bg-white/5"
            >
                <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors ${
                    selected ? 'border-sky-500 bg-sky-500 text-white' : 'border-current/20'
                }`}>
                    {selected && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{item.name}</span>
                    <span className="block truncate text-[10px] opacity-45">
                        {item.description || t('home.gridBatchTrackCount', { count: trackCount })}
                    </span>
                </span>
            </button>
        </div>
    );
};

export const GridMapBatchItemList = (props: GridMapBatchItemListProps) => (
    <VirtualList
        style={{ height: '100%', minHeight: 144, width: '100%' }}
        rowCount={props.items.length}
        rowHeight={48}
        rowProps={props}
        rowComponent={ItemRow}
        className="custom-scrollbar"
    />
);

export default GridMapBatchItemList;
