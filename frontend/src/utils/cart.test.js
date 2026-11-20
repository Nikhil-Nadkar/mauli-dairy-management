import { describe, expect, it } from "vitest";
import {
  addToCart,
  cartToItems,
  cartTotalPaise,
  lineTotalPaise,
  milliInCart,
  removeFromCart,
  toMilli,
} from "./cart.js";
import { formatQuantity, formatRupees, makeQuickButton, quickLabel } from "./format.js";

const milk = { id: 1, name: "Milk", base_unit: "litre", selling_price: "60.00" };
const paneer = { id: 2, name: "Paneer", base_unit: "kg", selling_price: "360.00" };

describe("cart maths", () => {
  it("rounds each line half-up to the paisa, exactly like the server", () => {
    expect(lineTotalPaise(333, "10.55")).toBe(351); // 3.51315 -> 3.51
    expect(lineTotalPaise(125, "33.33")).toBe(417); // 4.16625 -> 4.17
    expect(lineTotalPaise(250, "36.50")).toBe(913); // 9.125 -> 9.13 (tie goes up)
    expect(lineTotalPaise(1500, "60.00")).toBe(9000);
  });

  it("merges the same product and totals the cart", () => {
    let cart = addToCart([], milk, toMilli("1"));
    cart = addToCart(cart, paneer, toMilli("0.5"));
    cart = addToCart(cart, milk, toMilli("0.5"));
    expect(cart).toHaveLength(2);
    expect(milliInCart(cart, 1)).toBe(1500);
    expect(cartTotalPaise(cart)).toBe(9000 + 18000);
    expect(cartToItems(cart)).toEqual([
      { product_id: 1, quantity: "1.500" },
      { product_id: 2, quantity: "0.500" },
    ]);
  });

  it("removes a line", () => {
    const cart = addToCart(addToCart([], milk, 1000), paneer, 500);
    expect(removeFromCart(cart, 1).map((l) => l.product_id)).toEqual([2]);
  });

  it("never sends prices to the server", () => {
    const items = cartToItems(addToCart([], milk, 1000));
    expect(Object.keys(items[0])).toEqual(["product_id", "quantity"]);
  });
});

describe("display helpers", () => {
  it("formats quantities and rupees", () => {
    expect(formatQuantity("0.250", "litre")).toBe("250 ml");
    expect(formatQuantity("1.500", "litre")).toBe("1.5 L");
    expect(formatQuantity("0.100", "kg")).toBe("100 g");
    expect(formatRupees("60.00")).toBe("₹60");
    expect(formatRupees("62.5")).toBe("₹62.50");
    expect(formatRupees("123456")).toBe("₹1,23,456");
  });

  it("labels quick buttons the way the shop talks, with the exact amount", () => {
    const label = (quantity, unit, lang) => quickLabel({ quantity }, unit, lang);
    expect(label("0.250", "kg")).toEqual({ main: "Pav kilo", detail: "250 g" });
    expect(label("0.5", "litre")).toEqual({ main: "Half litre", detail: "500 ml" });
    expect(label("0.750", "kg")).toEqual({ main: "Paun kilo", detail: "750 g" });
    expect(label("0.150", "litre")).toEqual({ main: "150 ml", detail: null });
    expect(label("2.000", "litre")).toEqual({ main: "2 litres", detail: null });
    expect(label("1.000", "kg")).toEqual({ main: "1 kg", detail: null });
    expect(label("0.250", "kg", "mr")).toEqual({ main: "पाव किलो", detail: "250 ग्रॅ." });
    expect(label("0.500", "litre", "mr")).toEqual({ main: "अर्धा लिटर", detail: "500 मि.ली." });
    expect(label("1.000", "litre", "mr")).toEqual({ main: "1 लिटर", detail: null });
    expect(label("0.200", "kg", "mr")).toEqual({ main: "200 ग्रॅ.", detail: null });
  });

  it("builds quick buttons from what the owner types", () => {
    expect(makeQuickButton("250", "ml")).toEqual({ label: "Pav litre", quantity: "0.250" });
    expect(makeQuickButton("200", "g")).toEqual({ label: "200 g", quantity: "0.200" });
    expect(makeQuickButton("1000", "ml")).toEqual({ label: "1 litre", quantity: "1.000" });
    expect(makeQuickButton("2", "litre")).toEqual({ label: "2 litres", quantity: "2.000" });
    expect(makeQuickButton("0.5", "kg")).toEqual({ label: "Half kilo", quantity: "0.500" });
    expect(makeQuickButton("0", "g").error).toBeTruthy();
    expect(makeQuickButton("250.5", "ml").error).toBeTruthy();
    expect(makeQuickButton("0.0005", "litre").error).toBeTruthy();
  });
});
