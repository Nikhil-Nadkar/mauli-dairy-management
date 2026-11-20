import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "./Dashboard.jsx";
import Reports from "./reports/ReportsPage.jsx";
import { renderPage } from "../test/render.jsx";

const mockGet = vi.fn();
vi.mock("../api/client.js", () => ({
  default: { get: (...a) => mockGet(...a) },
  errorMessage: (err) => err?.response?.data?.detail ?? "Cannot reach the server.",
}));
vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => ({ isAdmin: true, user: { id: 1, full_name: "Owner", role: "admin", branch: null } }),
}));

// Same shapes the real API returns (money as strings).
const day = (date, sales, profit, n) => ({ date, sales, profit, sales_count: n });
const SUMMARY = (from, to) => ({
  date_from: from,
  date_to: to,
  branch_id: null,
  totals: { total_sales: "452.50", total_cost: "351.75", gross_profit: "100.75", sales_count: 3, items_sold: 5 },
  products: [
    {
      product_id: 1,
      name: "Milk",
      base_unit: "litre",
      quantity: "4.000",
      sales: "245.00",
      cost: "183.00",
      profit: "62.00",
    },
    {
      product_id: 2,
      name: "Paneer",
      base_unit: "kg",
      quantity: "0.500",
      sales: "180.00",
      cost: "150.00",
      profit: "30.00",
    },
  ],
  branches: [
    { branch_id: 1, name: "Branch 1", sales: "360.00", cost: "285.00", profit: "75.00", sales_count: 2 },
    { branch_id: 2, name: "Branch 2", sales: "92.50", cost: "66.75", profit: "25.75", sales_count: 1 },
  ],
  daily: [day(from, "0.00", "0.00", 0), day(to, "452.50", "100.75", 3)],
});
const SALES = {
  has_more: false,
  items: [
    {
      id: 7,
      branch_id: 1,
      branch_name: "Branch 1",
      user_id: 2,
      user_name: "Asha",
      created_at: "2026-11-01T10:30:00+05:30",
      total_amount: "240.00",
      total_cost: "195.00",
      profit: "45.00",
      items: [
        {
          product_id: 1,
          product_name: "Milk",
          base_unit: "litre",
          quantity: "1.000",
          selling_price: "60.00",
          item_total: "60.00",
          cost_price: "45.00",
          item_cost: "45.00",
        },
      ],
    },
  ],
};

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockImplementation(async (url, { params } = {}) => {
    if (url === "/api/branches")
      return {
        data: [
          { id: 1, name: "Branch 1" },
          { id: 2, name: "Branch 2" },
        ],
      };
    if (url === "/api/reports/summary")
      return { data: SUMMARY(params.date_from ?? "2026-10-26", params.date_to ?? "2026-11-01") };
    if (url === "/api/reports/low-stock")
      return {
        data: [
          {
            branch_id: 1,
            branch_name: "Branch 1",
            product_id: 3,
            name: "Dahi",
            base_unit: "kg",
            available: "0.000",
            status: "out_of_stock",
          },
        ],
      };
    if (url === "/api/sales") return { data: SALES };
    throw new Error(`unexpected GET ${url}`);
  });
});

describe("Dashboard", () => {
  it("shows today's cards, the low-stock list and the gross-profit disclaimer", async () => {
    renderPage(<Dashboard />);
    const overview = await screen.findByRole("region", { name: "Today's overview" });
    expect(within(overview).getByText("₹452.50")).toBeInTheDocument();
    expect(within(overview).getByText("₹100.75")).toBeInTheDocument();
    expect(within(overview).getByText("Low-stock products").nextSibling).toHaveTextContent("1");
    expect(screen.getByRole("region", { name: "Low stock" })).toHaveTextContent("Dahi (Branch 1) – OUT OF STOCK");
    expect(screen.getByText(/does/)).toHaveTextContent("not include rent, electricity, salaries");
  });

  it("asks the server for one branch when a branch is chosen", async () => {
    const user = userEvent.setup();
    renderPage(<Dashboard />);
    await screen.findByRole("region", { name: "Today's overview" });
    await user.click(screen.getByRole("button", { name: "Branch 2" }));
    await vi.waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith("/api/reports/summary", { params: { branch_id: 2, range: "today" } })
    );
  });
});

describe("Reports", () => {
  it("renders totals, tables and sales records for the default period", async () => {
    renderPage(<Reports />);
    const totals = await screen.findByRole("region", { name: "Totals" });
    expect(within(totals).getByText("₹351.75")).toBeInTheDocument();
    expect(within(totals).getByText("Cost of products sold")).toBeInTheDocument();
    const products = screen.getByRole("region", { name: "Product-wise sales" });
    expect(within(products).getByText("Milk")).toBeInTheDocument();
    expect(within(products).getByText("4 L")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Branch-wise sales" })).getByText("Branch 2")).toBeInTheDocument();
    expect(
      await within(screen.getByRole("region", { name: "Sales records" })).findByText(/Sold by Asha/)
    ).toBeInTheDocument();
  });

  it("only asks the server for a custom period once both dates are chosen", async () => {
    const user = userEvent.setup();
    renderPage(<Reports />);
    await screen.findByRole("region", { name: "Totals" });
    mockGet.mockClear();
    await user.click(screen.getByRole("button", { name: "Choose dates" }));
    expect(mockGet).not.toHaveBeenCalledWith("/api/reports/summary", expect.anything());
    await user.type(screen.getByLabelText("From"), "2026-10-01");
    await user.type(screen.getByLabelText("To"), "2026-10-15");
    await vi.waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith("/api/reports/summary", {
        params: { range: "custom", date_from: "2026-10-01", date_to: "2026-10-15" },
      })
    );
  });
});
