import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./app/AppShell.jsx";
import { homePath } from "./app/navigation.js";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { Loading } from "./components/ui/Feedback.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import Account from "./pages/Account.jsx";
import Login from "./pages/Login.jsx";
import More from "./pages/More.jsx";
import EditProduct from "./pages/products/EditProduct.jsx";
import NewProduct from "./pages/products/NewProduct.jsx";
import ProductsPage from "./pages/products/ProductsPage.jsx";
import SalesPage from "./pages/sales/SalesPage.jsx";
import CorrectStock from "./pages/stock/CorrectStock.jsx";
import ReceiveStock from "./pages/stock/ReceiveStock.jsx";
import StockHistory from "./pages/stock/StockHistory.jsx";
import StockHome from "./pages/stock/StockHome.jsx";
import NewUser from "./pages/users/NewUser.jsx";
import UsersPage from "./pages/users/UsersPage.jsx";

// Only the owner's pages use charts, so staff phones never download the chart library.
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const ReportsPage = lazy(() => import("./pages/reports/ReportsPage.jsx"));

function Home() {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homePath(isAdmin)} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Home />} />

        {/* Pages for everyone who is logged in */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/stock" element={<StockHome />} />
            <Route path="/stock/arrived" element={<ReceiveStock />} />
            <Route path="/stock/correct" element={<CorrectStock />} />
            <Route path="/stock/history" element={<StockHistory />} />
            <Route path="/stock-overview" element={<Navigate to="/stock" replace />} />
            <Route path="/account" element={<Account />} />
          </Route>
        </Route>

        {/* Owner-only pages (cost prices, profit, users) */}
        <Route element={<ProtectedRoute adminOnly />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/new" element={<NewProduct />} />
            <Route path="/products/:id" element={<EditProduct />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/users/new" element={<NewUser />} />
            <Route path="/more" element={<More />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
