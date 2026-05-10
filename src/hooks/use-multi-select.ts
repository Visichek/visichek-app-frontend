"use client";

import * as React from "react";

export interface UseMultiSelectResult<TItem> {
  selectedIds: string[];
  selectedItems: TItem[];
  selectedCount: number;
  isSelected: (id: string) => boolean;
  toggleOne: (id: string) => void;
  setSelected: (id: string, value: boolean) => void;
  toggleAll: () => void;
  selectAll: () => void;
  clear: () => void;
  allSelected: boolean;
  someSelected: boolean;
}

export function useMultiSelect<TItem>(
  items: ReadonlyArray<TItem>,
  getId: (item: TItem) => string
): UseMultiSelectResult<TItem> {
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());

  const visibleIds = React.useMemo(() => items.map(getId), [items, getId]);
  const visibleIdSet = React.useMemo(() => new Set(visibleIds), [visibleIds]);

  // Drop ids that are no longer in the visible item set so the selection
  // stays consistent with what the user can see (per CLAUDE.md rule).
  React.useEffect(() => {
    setSelected((prev) => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (visibleIdSet.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [visibleIdSet]);

  const toggleOne = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setSelectedExplicit = React.useCallback((id: string, value: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const selectAll = React.useCallback(() => {
    setSelected(new Set(visibleIds));
  }, [visibleIds]);

  const clear = React.useCallback(() => {
    setSelected(new Set());
  }, []);

  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = !allSelected && visibleIds.some((id) => selected.has(id));

  const toggleAll = React.useCallback(() => {
    if (allSelected) clear();
    else selectAll();
  }, [allSelected, clear, selectAll]);

  const selectedItems = React.useMemo(
    () => items.filter((item) => selected.has(getId(item))),
    [items, selected, getId]
  );

  const selectedIds = React.useMemo(() => Array.from(selected), [selected]);

  const isSelected = React.useCallback((id: string) => selected.has(id), [selected]);

  return {
    selectedIds,
    selectedItems,
    selectedCount: selected.size,
    isSelected,
    toggleOne,
    setSelected: setSelectedExplicit,
    toggleAll,
    selectAll,
    clear,
    allSelected,
    someSelected,
  };
}
