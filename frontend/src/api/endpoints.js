// Every call the app makes to the server, in one place. Each returns the response data.
import api from "./client.js";

const data = (request) => request.then((res) => res.data);

// Branches
export const getBranches = () => data(api.get("/api/branches"));

// Products & prices
export const getCatalog = (params) => data(api.get("/api/products/catalog", { params }));
export const getProducts = () => data(api.get("/api/products"));
export const createProduct = (body) => data(api.post("/api/products", body));
export const updateProduct = (id, body) => data(api.patch(`/api/products/${id}`, body));
export const savePrices = (id, prices) => data(api.put(`/api/prices/${id}`, { prices }));

// Stock
export const getStock = (params) => data(api.get("/api/stock", { params }));
export const getStockHistory = (params) => data(api.get("/api/stock/movements", { params }));
export const receiveStock = (body) => data(api.post("/api/stock/receive", body));
export const adjustStock = (body) => data(api.post("/api/stock/adjust", body));

// Sales
export const createSale = (body) => data(api.post("/api/sales", body));
export const undoSale = (id) => data(api.post(`/api/sales/${id}/undo`));
export const getSales = (params) => data(api.get("/api/sales", { params }));

// Reports
export const getSummary = (params) => data(api.get("/api/reports/summary", { params }));
export const getLowStock = (params) => data(api.get("/api/reports/low-stock", { params }));

// Users
export const getUsers = () => data(api.get("/api/users"));
export const createUser = (body) => data(api.post("/api/users", body));
export const updateUser = (id, body) => data(api.patch(`/api/users/${id}`, body));
export const resetPassword = (id, newPassword) =>
  data(api.post(`/api/users/${id}/reset-password`, { new_password: newPassword }));

/** How long after saving a sale the "Undo" button is shown. Matches UNDO_WINDOW_MINUTES on the server. */
export const UNDO_MINUTES = 5;
