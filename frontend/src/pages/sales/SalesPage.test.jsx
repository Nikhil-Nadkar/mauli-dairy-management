import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderPage } from "../../test/render.jsx";
import SalesPage from "./SalesPage.jsx";

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock("../../api/client.js", () => ({
  default: { get: (...a) => mockGet(...a), post: (...a) => mockPost(...a) },
  errorMessage: (err) => err?.response?.data?.detail ?? "Cannot reach the server.",
}));
vi.mock("../../context/AuthContext.jsx", () => ({
  useAuth: () => ({
    isAdmin: false,
    user: { id: 2, full_name: "Asha", role: "staff", branch: { id: 1, name: "Branch 1" } },
  }),
}));

const quick = (items) => items.map(([label, quantity]) => ({ label, quantity }));
const CATALOG = [
  {
    id: 1,
    name: "Milk",
    base_unit: "litre",
    selling_price: "60.00",
    quick_quantities: quick([
      ["250 ml", "0.250"],
      ["500 ml", "0.500"],
      ["1 litre", "1.000"],
      ["2 litres", "2.000"],
    ]),
  },
  {
    id: 2,
    name: "Paneer",
    base_unit: "kg",
    selling_price: "360.00",
    quick_quantities: quick([
      ["250 g", "0.250"],
      ["500 g", "0.500"],
      ["1 kg", "1.000"],
    ]),
  },
  { id: 3, name: "Chaas", base_unit: "litre", selling_price: "20.00", quick_quantities: quick([["500 ml", "0.500"]]) },
  { id: 4, name: "Lassi", base_unit: "litre", selling_price: null, quick_quantities: quick([["500 ml", "0.500"]]) },
];
const STOCK = [
  { product_id: 1, available: "1.500" },
  { product_id: 2, available: "10.000" },
  { product_id: 3, available: "0.000" },
  { product_id: 4, available: "9.000" },
];

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockGet.mockImplementation(async (url) => {
    if (url === "/api/branches") return { data: [{ id: 1, name: "Branch 1" }] };
    if (url === "/api/products/catalog") return { data: CATALOG };
    if (url === "/api/stock") return { data: STOCK };
    throw new Error(`unexpected GET ${url}`);
  });
});

async function open() {
  const user = userEvent.setup();
  renderPage(<SalesPage />);
  await screen.findByRole("button", { name: /^Milk/ });
  return user;
}
const card = (name) => screen.getByRole("button", { name: new RegExp(`^${name}`) }); // cards start with the name
const billBar = () => screen.getByRole("button", { name: /Check bill/ });
const noBillBar = () => expect(screen.queryByRole("button", { name: /Check bill/ })).not.toBeInTheDocument();
const dialog = () => screen.getByRole("dialog");

/** Tap a product, then a quick amount in the sheet that opens. */
async function addItem(user, product, amount) {
  await user.click(card(product));
  await user.click(within(dialog()).getByRole("button", { name: new RegExp(`^${amount}`) }));
}

describe("Selling", () => {
  it("shows prices and blocks products that cannot be sold", async () => {
    await open();
    expect(card("Milk")).toHaveTextContent("₹60/L");
    expect(card("Milk")).toBeEnabled();
    expect(card("Chaas")).toBeDisabled();
    expect(card("Chaas")).toHaveTextContent("OUT OF STOCK");
    expect(card("Lassi")).toBeDisabled();
    expect(card("Lassi")).toHaveTextContent("Price not set");
    noBillBar(); // nothing in the bill yet
  });

  it("builds a bill, checks it, and saves it without sending any prices", async () => {
    mockPost.mockResolvedValue({ data: { id: 7, total_amount: "240.00" } });
    const user = await open();

    await addItem(user, "Milk", "1 litre");
    await addItem(user, "Paneer", "Half kilo");
    expect(card("Paneer")).toHaveTextContent("In bill: 500 g");
    expect(billBar()).toHaveTextContent("Check bill · 2 items · ₹240");

    // The bill is shown before anything is saved; a line can be removed there.
    await user.click(billBar());
    const bill = dialog();
    expect(within(bill).getByText("Milk")).toBeInTheDocument();
    expect(within(bill).getByText("500 g")).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
    await user.click(within(bill).getByRole("button", { name: "Remove Paneer" }));
    expect(within(dialog()).getByTestId("bill-total")).toHaveTextContent("₹60");

    await user.click(within(dialog()).getByRole("button", { name: "Add more items" }));
    await addItem(user, "Paneer", "Half kilo");
    await user.click(billBar());
    await user.click(within(dialog()).getByRole("button", { name: "Save sale" }));

    expect(mockPost).toHaveBeenCalledWith("/api/sales", {
      items: [
        { product_id: 1, quantity: "1.000" },
        { product_id: 2, quantity: "0.500" },
      ],
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Sale saved! Total ₹240");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    noBillBar(); // ready for the next customer
  });

  it("can undo the sale just saved, after asking first", async () => {
    mockPost.mockImplementation(async (url) =>
      url === "/api/sales" ? { data: { id: 7, total_amount: "60.00" } } : { data: {} }
    );
    const user = await open();
    await addItem(user, "Milk", "1 litre");
    await user.click(billBar());
    await user.click(within(dialog()).getByRole("button", { name: "Save sale" }));

    await user.click(await screen.findByRole("button", { name: "Undo this sale" }));
    expect(dialog()).toHaveTextContent("Cancel this sale of ₹60?");
    expect(mockPost).not.toHaveBeenCalledWith("/api/sales/7/undo");
    await user.click(within(dialog()).getByRole("button", { name: "Yes, cancel the sale" }));

    expect(mockPost).toHaveBeenCalledWith("/api/sales/7/undo");
    expect(await screen.findByRole("status")).toHaveTextContent("The sale was cancelled");
  });

  it("disables amounts that are more than the stock left, counting what is already in the bill", async () => {
    const user = await open();
    await user.click(card("Milk")); // 1.5 L in stock
    const twoLitres = within(dialog()).getByRole("button", { name: /^2 litres/ });
    expect(twoLitres).toBeDisabled();
    expect(twoLitres).toHaveTextContent("Not enough stock");
    await user.click(within(dialog()).getByRole("button", { name: /^1 litre/ }));

    await user.click(card("Milk")); // 0.5 L left now
    expect(within(dialog()).getByRole("button", { name: /^1 litre/ })).toBeDisabled();
    await user.click(within(dialog()).getByRole("button", { name: /^Half litre/ }));
    expect(card("Milk")).toBeDisabled(); // everything is in the bill
    expect(screen.getByTestId("cart-total")).toHaveTextContent("₹90");
  });

  it("accepts another amount and refuses one that is too big", async () => {
    const user = await open();
    await user.click(card("Milk"));
    const box = within(dialog()).getByLabelText(/Other amount/);
    await user.type(box, "3");
    await user.click(within(dialog()).getByRole("button", { name: "Add" }));
    expect(within(dialog()).getByRole("alert")).toHaveTextContent("Not enough Milk. Only 1.5 L left.");

    await user.clear(box);
    await user.type(box, "0.75");
    await user.click(within(dialog()).getByRole("button", { name: "Add" }));
    expect(screen.getByTestId("cart-total")).toHaveTextContent("₹45");
  });

  it("shows the server's message and keeps the bill when the sale is refused", async () => {
    mockPost.mockRejectedValue({ response: { data: { detail: "Not enough Milk. Only 1 L left." } } });
    const user = await open();
    await addItem(user, "Milk", "1 litre");
    await user.click(billBar());
    await user.click(within(dialog()).getByRole("button", { name: "Save sale" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Not enough Milk. Only 1 L left.");
    expect(screen.getByTestId("cart-total")).toHaveTextContent("₹60"); // nothing lost
  });

  it("speaks Marathi when Marathi was chosen, including the server's common messages", async () => {
    localStorage.setItem("dairy_language", "mr");
    mockPost.mockRejectedValue({ response: { data: { detail: "Not enough Milk. Only 1 L left." } } });
    const user = userEvent.setup();
    renderPage(<SalesPage />);
    await screen.findByRole("button", { name: /^Milk/ });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("विक्री");
    expect(card("Milk")).toHaveTextContent("₹60/लि.");

    await user.click(card("Milk"));
    await user.click(within(dialog()).getByRole("button", { name: /^1 लिटर/ }));
    await user.click(screen.getByRole("button", { name: /बिल तपासा/ }));
    await user.click(within(dialog()).getByRole("button", { name: "विक्री जतन करा" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Milk पुरेसे नाही. फक्त 1 L शिल्लक.");
  });
});
