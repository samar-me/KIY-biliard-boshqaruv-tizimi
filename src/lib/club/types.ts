export const TABLE_KINDS = ["rus", "pool", "snooker"] as const;
export type TableKind = (typeof TABLE_KINDS)[number];

export const KIND_LABEL: Record<TableKind, string> = {
  rus: "Rus",
  pool: "Amerikan",
  snooker: "Snuker",
};

export const PRODUCT_CATEGORIES = ["ichimlik", "gazak"] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  ichimlik: "Ichimlik",
  gazak: "Gazak",
};

export const PAY_METHODS = ["naqd", "karta"] as const;
export type PayMethod = (typeof PAY_METHODS)[number];

export const PAY_LABEL: Record<PayMethod, string> = {
  naqd: "Naqd",
  karta: "Karta",
};

export type TicketItem = {
  id: number;
  name: string;
  unitPrice: number;
  qty: number;
  productId: number | null;
};

export type OpenSession = {
  id: number;
  startedAt: string;
  hourlyRate: number;
  items: TicketItem[];
};

export type FloorTable = {
  id: number;
  name: string;
  kind: TableKind;
  hourlyRate: number;
  sortOrder: number;
  session: OpenSession | null;
};

export type Product = {
  id: number;
  name: string;
  category: ProductCategory;
  price: number;
  sortOrder: number;
  active: boolean;
};

export type FloorPayload = {
  tables: FloorTable[];
  products: Product[];
  todayClosedTotal: number;
};

export type Receipt = {
  id: number;
  tableName: string | null;
  kind: "table" | "bar";
  startedAt: string;
  endedAt: string;
  elapsedLabel: string;
  hourlyRate: number;
  timeCharge: number;
  items: TicketItem[];
  itemsTotal: number;
  total: number;
  payMethod: PayMethod;
};

export type ReportRow = {
  id: number;
  tableName: string | null;
  kind: string;
  endedAt: string;
  timeCharge: number;
  itemsTotal: number;
  total: number;
  payMethod: PayMethod | null;
};

export type ReportPayload = {
  day: string;
  tickets: ReportRow[];
  byPay: { naqd: number; karta: number };
  byKind: { table: number; bar: number };
  topProducts: { name: string; qty: number; total: number }[];
  hourly: { hour: string; total: number }[];
  sessionCount: number;
  tableHours: number;
};

export type CatalogTable = {
  id: number;
  name: string;
  kind: TableKind;
  hourlyRate: number;
  sortOrder: number;
  active: boolean;
};
