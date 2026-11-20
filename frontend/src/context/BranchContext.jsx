import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { errorMessage } from "../api/client.js";
import { getBranches } from "../api/endpoints.js";
import { storage } from "../utils/storage.js";
import { useAuth } from "./AuthContext.jsx";

/*
 * Which branch is a page about?
 *
 *  - Staff: always their own branch. We never send branch_id; the server enforces it.
 *  - Owner: picks a branch with the big buttons at the top of the page. Two separate choices are remembered:
 *      "work" - Sell and Stock pages. Must be ONE branch.
 *      "view" - Home and Reports. May also be "Both branches" (null).
 */

const BranchContext = createContext(null);
const SAVED = { work: "dairy_branch_work", view: "dairy_branch_view" };

const readSaved = (key) => {
  const id = Number(storage.get(key));
  return Number.isInteger(id) && id > 0 ? id : null;
};

export function BranchProvider({ children }) {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState(() => ({ work: readSaved(SAVED.work), view: readSaved(SAVED.view) }));

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let current = true;
    getBranches()
      .then((list) => current && setBranches(list))
      .catch((err) => current && setError(errorMessage(err)))
      .finally(() => current && setLoaded(true));
    return () => {
      current = false;
    };
  }, [userId]);

  const choose = useCallback((mode, id) => {
    if (id === null) storage.remove(SAVED[mode]);
    else storage.set(SAVED[mode], String(id));
    setChosen((c) => ({ ...c, [mode]: id }));
  }, []);

  const value = useMemo(() => ({ branches, loaded, error, chosen, choose }), [branches, loaded, error, chosen, choose]);
  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

/**
 * const scope = useBranchScope("work" | "view");
 *   scope.params / scope.body  -> spread into API calls ({} for staff, { branch_id } for the owner)
 *   scope.ready               -> false while the owner still has to pick a branch ("work" pages)
 */
export function useBranchScope(mode) {
  const { user, isAdmin } = useAuth();
  const { branches, loaded, error, chosen, choose } = useContext(BranchContext);

  let branchId;
  if (!isAdmin) {
    branchId = user?.branch?.id ?? user?.branch_id ?? null;
  } else {
    const saved = branches.some((b) => b.id === chosen[mode]) ? chosen[mode] : null;
    // A "work" page always needs one branch: fall back to the first one.
    branchId = mode === "work" ? (saved ?? branches[0]?.id ?? null) : saved;
  }

  const params = useMemo(() => (isAdmin && branchId ? { branch_id: branchId } : {}), [isAdmin, branchId]);
  const setBranchId = useCallback((id) => choose(mode, id), [choose, mode]);

  return {
    mode,
    isAdmin,
    branches,
    branchId,
    setBranchId,
    branchName: isAdmin ? (branches.find((b) => b.id === branchId)?.name ?? "") : (user?.branch?.name ?? ""),
    params,
    body: params,
    ready: !isAdmin || (mode === "view" ? loaded : branchId !== null),
    error,
  };
}
