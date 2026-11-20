// Cart maths in whole numbers (thousandths of a litre/kg, paise) so rupees never drift.
// Rounding matches the server: each line is rounded half-up to the paisa, the total is the sum of lines.
import { formatRupees } from "./format.js";

export const toMilli = (quantity) => Math.round(Number(quantity) * 1000);
export const milliToQuantity = (milli) => (milli / 1000).toFixed(3);
const toPaise = (rupees) => Math.round(Number(rupees) * 100);

/** quantity "0.500" x price "360.00" -> 18000 (paise) */
export const lineTotalPaise = (milli, sellingPrice) => Math.floor((milli * toPaise(sellingPrice) + 500) / 1000);

export const formatPaise = (paise) => formatRupees(paise / 100);

/** Adds quantity (in thousandths) of a product; repeated products are merged into one line. */
export function addToCart(cart, product, milli) {
  const existing = cart.find((l) => l.product_id === product.id);
  if (existing) {
    return cart.map((l) => (l.product_id === product.id ? { ...l, milli: l.milli + milli } : l));
  }
  return [
    ...cart,
    { product_id: product.id, name: product.name, base_unit: product.base_unit, price: product.selling_price, milli },
  ];
}

export const removeFromCart = (cart, productId) => cart.filter((l) => l.product_id !== productId);

export const milliInCart = (cart, productId) => cart.find((l) => l.product_id === productId)?.milli ?? 0;

export const cartTotalPaise = (cart) => cart.reduce((sum, l) => sum + lineTotalPaise(l.milli, l.price), 0);

/** The body sent to the server. Prices are NOT sent - the server looks them up. */
export const cartToItems = (cart) =>
  cart.map((l) => ({ product_id: l.product_id, quantity: milliToQuantity(l.milli) }));
