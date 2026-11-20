import { BarChart3, Boxes, House, LayoutGrid, Package, ShoppingCart, UserRound, Users } from "lucide-react";

// The menu, defined once. `label` is a translation key.
// Phones show `tabs` in a bottom bar (max 5); bigger screens show `sidebar`.

const HOME = { to: "/dashboard", label: "nav.home", icon: House };
const SELL = { to: "/sales", label: "nav.sell", icon: ShoppingCart };
const STOCK = { to: "/stock", label: "nav.stock", icon: Boxes };
const REPORTS = { to: "/reports", label: "nav.reports", icon: BarChart3 };
const PRODUCTS = { to: "/products", label: "nav.products", icon: Package };
const USERS = { to: "/users", label: "nav.users", icon: Users };
const ACCOUNT = { to: "/account", label: "nav.account", icon: UserRound };
const MORE = { to: "/more", label: "nav.more", icon: LayoutGrid, also: ["/products", "/users", "/account"] };

export const NAV = {
  owner: {
    tabs: [HOME, SELL, STOCK, REPORTS, MORE],
    sidebar: [HOME, SELL, STOCK, REPORTS, PRODUCTS, USERS, ACCOUNT],
    more: [PRODUCTS, USERS, ACCOUNT],
  },
  staff: {
    tabs: [SELL, STOCK, ACCOUNT],
    sidebar: [SELL, STOCK, ACCOUNT],
    more: [],
  },
};

/** Where each kind of user lands after logging in. */
export const homePath = (isAdmin) => (isAdmin ? HOME.to : SELL.to);

/** Is this menu item the current page (including its sub-pages, e.g. /stock/arrived)? */
export const isCurrent = (item, pathname) =>
  [item.to, ...(item.also ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
