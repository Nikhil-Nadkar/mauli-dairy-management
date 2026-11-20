import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../api/client.js";
import { useT } from "../i18n/LanguageContext.jsx";

/**
 * Loads data for a page and reloads it when `loader` changes.
 *
 *   const loader = useCallback(() => getStock(scope.params), [scope.params]);
 *   const { data, error, loading, reload } = useLoad(loader, { enabled: scope.ready });
 *
 * If the page asks again before an older answer arrives (e.g. the owner switches branch quickly),
 * the older answer is thrown away.
 */
export function useLoad(loader, { enabled = true } = {}) {
  const { tError } = useT();
  const [state, setState] = useState({ data: null, error: "", loading: enabled });
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const request = ++latest.current;
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await loader();
      if (request === latest.current) setState({ data, error: "", loading: false });
    } catch (err) {
      if (request === latest.current) setState((s) => ({ ...s, error: tError(errorMessage(err)), loading: false }));
    }
  }, [loader, tError]);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  /** Change the loaded data without asking the server (e.g. add the next page of a list). */
  const setData = useCallback((update) => setState((s) => ({ ...s, data: update(s.data) })), []);

  return { ...state, reload, setData };
}

/**
 * A list that loads one page at a time with a "Show more" button.
 *
 *   const fetchPage = useCallback((page) => getSales({ ...filters, ...page }), [filters]);
 *   const list = usePagedList(fetchPage, { pageSize: 15 });
 *   list.items, list.hasMore, list.showMore()
 */
export function usePagedList(fetchPage, { enabled = true, pageSize = 20 } = {}) {
  const { tError } = useT();
  const loader = useCallback(() => fetchPage({ limit: pageSize, offset: 0 }), [fetchPage, pageSize]);
  const { data, error, loading, reload, setData } = useLoad(loader, { enabled });
  const [moreError, setMoreError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  async function showMore() {
    setLoadingMore(true);
    setMoreError("");
    try {
      const next = await fetchPage({ limit: pageSize, offset: data.items.length });
      setData((d) => ({ items: [...d.items, ...next.items], has_more: next.has_more }));
    } catch (err) {
      setMoreError(tError(errorMessage(err)));
    } finally {
      setLoadingMore(false);
    }
  }

  return {
    items: data?.items ?? [],
    hasMore: Boolean(data?.has_more),
    loaded: data !== null,
    loading,
    loadingMore,
    error: error || moreError,
    showMore,
    reload,
  };
}
