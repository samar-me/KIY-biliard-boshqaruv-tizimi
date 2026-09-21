import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import {
  dayBounds,
  elapsedMs,
  formatElapsed,
  tashkentDay,
  timeCharge,
} from "./money";
import type {
  CatalogTable,
  FloorPayload,
  FloorTable,
  PayMethod,
  Product,
  ProductCategory,
  Receipt,
  ReportPayload,
  TableKind,
  TicketItem,
} from "./types";

type TableRow = {
  id: number;
  name: string;
  kind: string;
  hourly_rate: number;
  sort_order: number;
  active: boolean;
};

type TicketRow = {
  id: number;
  table_id: number | null;
  kind: string;
  started_at: string | Date;
  ended_at: string | Date | null;
  hourly_rate: number;
  time_charge: number;
  items_total: number;
  total: number;
  pay_method: string | null;
  status: string;
};

type ItemRow = {
  id: number;
  ticket_id: number;
  product_id: number | null;
  name: string;
  unit_price: number;
  qty: number;
};

type ProductRow = {
  id: number;
  name: string;
  category: string;
  price: number;
  sort_order: number;
  active: boolean;
};

function iso(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : String(value);
}

function asKind(value: string): TableKind {
  if (value === "rus" || value === "pool" || value === "snooker") return value;
  return "pool";
}

function asCategory(value: string): ProductCategory {
  return value === "gazak" ? "gazak" : "ichimlik";
}

function asPay(value: string | null): PayMethod {
  return value === "karta" ? "karta" : "naqd";
}

function mapItem(row: ItemRow): TicketItem {
  return {
    id: row.id,
    name: row.name,
    unitPrice: row.unit_price,
    qty: row.qty,
    productId: row.product_id,
  };
}

export const getFloor = createServerFn({ method: "GET" }).handler(
  async (): Promise<FloorPayload> => {
    const sql = await getSql();
    const { start, end } = dayBounds(tashkentDay());

    // Execute independent queries in parallel for ultra-low latency
    const [tables, sessions, closed, products] = await Promise.all([
      sql<TableRow>`
        select id, name, kind, hourly_rate, sort_order, active
        from club_tables
        where active = true
        order by sort_order, id
      `,
      sql<TicketRow>`
        select id, table_id, kind, started_at, ended_at, hourly_rate,
               time_charge, items_total, total, pay_method, status
        from tickets
        where status = 'open' and kind = 'table'
      `,
      sql.query<{ total: number }>(
        `select coalesce(sum(total), 0)::int as total
         from tickets
         where status = 'closed' and ended_at >= $1::timestamptz and ended_at < $2::timestamptz`,
        [start, end],
      ),
      sql<ProductRow>`
        select id, name, category, price, sort_order, active
        from products
        where active = true
        order by sort_order, id
      `,
    ]);

    const sessionIds = sessions.map((s) => s.id);
    let items: ItemRow[] = [];
    if (sessionIds.length > 0) {
      items = await sql.query<ItemRow>(
        `select id, ticket_id, product_id, name, unit_price, qty
         from ticket_items where ticket_id = any($1::int[])
         order by id`,
        [sessionIds],
      );
    }
    const itemsByTicket = new Map<number, TicketItem[]>();
    for (const item of items) {
      const list = itemsByTicket.get(item.ticket_id) ?? [];
      list.push(mapItem(item));
      itemsByTicket.set(item.ticket_id, list);
    }
    const sessionByTable = new Map<number, TicketRow>();
    for (const session of sessions) {
      if (session.table_id != null) sessionByTable.set(session.table_id, session);
    }


    const floorTables: FloorTable[] = tables.map((table) => {
      const session = sessionByTable.get(table.id);
      return {
        id: table.id,
        name: table.name,
        kind: asKind(table.kind),
        hourlyRate: table.hourly_rate,
        sortOrder: table.sort_order,
        session: session
          ? {
              id: session.id,
              startedAt: iso(session.started_at),
              hourlyRate: session.hourly_rate,
              items: itemsByTicket.get(session.id) ?? [],
            }
          : null,
      };
    });

    return {
      tables: floorTables,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        category: asCategory(p.category),
        price: p.price,
        sortOrder: p.sort_order,
        active: p.active,
      })),
      todayClosedTotal: closed[0]?.total ?? 0,
    };
  },
);

export const startSession = createServerFn({ method: "POST" })
  .validator(z.object({ tableId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const tables = await sql<TableRow>`
      select id, name, kind, hourly_rate, sort_order, active
      from club_tables where id = ${data.tableId} and active = true
    `;
    const table = tables[0];
    if (!table) throw new Error("Stol topilmadi");
    const open = await sql<{ id: number }>`
      select id from tickets
      where table_id = ${data.tableId} and status = 'open' and kind = 'table'
      limit 1
    `;
    if (open[0]) throw new Error("Bu stol allaqachon band");
    const inserted = await sql<{ id: number; started_at: string | Date }>`
      insert into tickets (table_id, kind, hourly_rate, status)
      values (${table.id}, 'table', ${table.hourly_rate}, 'open')
      returning id, started_at
    `;
    const row = inserted[0];
    if (!row) throw new Error("Seans ochilmadi");
    return { id: row.id, startedAt: iso(row.started_at) };
  });

export const addItem = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ticketId: z.number().int().positive(),
      productId: z.number().int().positive(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const tickets = await sql<TicketRow>`
      select id, table_id, kind, started_at, ended_at, hourly_rate,
             time_charge, items_total, total, pay_method, status
      from tickets where id = ${data.ticketId}
    `;
    const ticket = tickets[0];
    if (!ticket || ticket.status !== "open") throw new Error("Seans ochiq emas");
    const products = await sql<ProductRow>`
      select id, name, category, price, sort_order, active
      from products where id = ${data.productId} and active = true
    `;
    const product = products[0];
    if (!product) throw new Error("Mahsulot topilmadi");
    const existing = await sql<ItemRow>`
      select id, ticket_id, product_id, name, unit_price, qty
      from ticket_items
      where ticket_id = ${ticket.id} and product_id = ${product.id}
      order by id
      limit 1
    `;
    if (existing[0]) {
      await sql`
        update ticket_items set qty = qty + 1 where id = ${existing[0].id}
      `;
      return { ok: true as const };
    }
    await sql`
      insert into ticket_items (ticket_id, product_id, name, unit_price, qty)
      values (${ticket.id}, ${product.id}, ${product.name}, ${product.price}, 1)
    `;
    return { ok: true as const };
  });

export const bumpItem = createServerFn({ method: "POST" })
  .validator(
    z.object({
      itemId: z.number().int().positive(),
      delta: z.union([z.literal(1), z.literal(-1)]),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const items = await sql<ItemRow & { status: string }>`
      select i.id, i.ticket_id, i.product_id, i.name, i.unit_price, i.qty, t.status
      from ticket_items i
      join tickets t on t.id = i.ticket_id
      where i.id = ${data.itemId}
    `;
    const item = items[0];
    if (!item || item.status !== "open") throw new Error("Seans ochiq emas");
    const next = item.qty + data.delta;
    if (next <= 0) {
      await sql`delete from ticket_items where id = ${item.id}`;
    } else {
      await sql`update ticket_items set qty = ${next} where id = ${item.id}`;
    }
    return { ok: true as const };
  });

export const closeSession = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ticketId: z.number().int().positive(),
      payMethod: z.enum(["naqd", "karta"]),
    }),
  )
  .handler(async ({ data }): Promise<Receipt> => {
    const sql = await getSql();
    const tickets = await sql<TicketRow>`
      select id, table_id, kind, started_at, ended_at, hourly_rate,
             time_charge, items_total, total, pay_method, status
      from tickets where id = ${data.ticketId}
    `;
    const ticket = tickets[0];
    if (!ticket) throw new Error("Seans topilmadi");
    if (ticket.status !== "open") throw new Error("Seans allaqachon yopilgan");
    const items = await sql<ItemRow>`
      select id, ticket_id, product_id, name, unit_price, qty
      from ticket_items where ticket_id = ${ticket.id} order by id
    `;
    const now = Date.now();
    const startedAt = iso(ticket.started_at);
    const charge =
      ticket.kind === "table"
        ? timeCharge(ticket.hourly_rate, startedAt, now)
        : 0;
    const itemsTotal = items.reduce((sum, i) => sum + i.unit_price * i.qty, 0);
    const total = charge + itemsTotal;
    const ended = new Date(now).toISOString();
    await sql`
      update tickets
      set ended_at = ${ended}::timestamptz,
          time_charge = ${charge},
          items_total = ${itemsTotal},
          total = ${total},
          pay_method = ${data.payMethod},
          status = 'closed'
      where id = ${ticket.id} and status = 'open'
    `;
    let tableName: string | null = null;
    if (ticket.table_id != null) {
      const names = await sql<{ name: string }>`
        select name from club_tables where id = ${ticket.table_id}
      `;
      tableName = names[0]?.name ?? null;
    }
    return {
      id: ticket.id,
      tableName,
      kind: ticket.kind === "bar" ? "bar" : "table",
      startedAt,
      endedAt: ended,
      elapsedLabel: formatElapsed(elapsedMs(startedAt, now)),
      hourlyRate: ticket.hourly_rate,
      timeCharge: charge,
      items: items.map(mapItem),
      itemsTotal,
      total,
      payMethod: data.payMethod,
    };
  });

export const cancelSession = createServerFn({ method: "POST" })
  .validator(z.object({ ticketId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const tickets = await sql<TicketRow>`
      select id, table_id, kind, started_at, ended_at, hourly_rate,
             time_charge, items_total, total, pay_method, status
      from tickets where id = ${data.ticketId}
    `;
    const ticket = tickets[0];
    if (!ticket || ticket.status !== "open") throw new Error("Seans ochiq emas");
    const items = await sql<{ n: number }>`
      select coalesce(sum(qty), 0)::int as n from ticket_items where ticket_id = ${ticket.id}
    `;
    const startedAt = iso(ticket.started_at);
    const charge = timeCharge(ticket.hourly_rate, startedAt, Date.now());
    if ((items[0]?.n ?? 0) > 0 || charge > 0) {
      throw new Error("Bekor qilib bo'lmaydi — avval mahsulot yoki vaqt bor");
    }
    await sql`delete from ticket_items where ticket_id = ${ticket.id}`;
    await sql`delete from tickets where id = ${ticket.id} and status = 'open'`;
    return { ok: true as const };
  });

export const checkoutBar = createServerFn({ method: "POST" })
  .validator(
    z.object({
      payMethod: z.enum(["naqd", "karta"]),
      lines: z
        .array(
          z.object({
            productId: z.number().int().positive(),
            qty: z.number().int().positive().max(99),
          }),
        )
        .min(1)
        .max(40),
    }),
  )
  .handler(async ({ data }): Promise<Receipt> => {
    const sql = await getSql();
    const ids = data.lines.map((l) => l.productId);
    const products = await sql.query<ProductRow>(
      `select id, name, category, price, sort_order, active
       from products where active = true and id = any($1::int[])`,
      [ids],
    );
    const byId = new Map(products.map((p) => [p.id, p]));
    const resolved: TicketItem[] = [];
    let itemsTotal = 0;
    for (const line of data.lines) {
      const product = byId.get(line.productId);
      if (!product) throw new Error("Mahsulot topilmadi");
      itemsTotal += product.price * line.qty;
      resolved.push({
        id: 0,
        name: product.name,
        unitPrice: product.price,
        qty: line.qty,
        productId: product.id,
      });
    }
    const nowIso = new Date().toISOString();
    const inserted = await sql<{ id: number }>`
      insert into tickets (
        table_id, kind, started_at, ended_at, hourly_rate,
        time_charge, items_total, total, pay_method, status
      ) values (
        null, 'bar', ${nowIso}::timestamptz, ${nowIso}::timestamptz, 0,
        0, ${itemsTotal}, ${itemsTotal}, ${data.payMethod}, 'closed'
      )
      returning id
    `;
    const ticketId = inserted[0]?.id;
    if (!ticketId) throw new Error("Chek yozilmadi");
    for (const line of resolved) {
      await sql`
        insert into ticket_items (ticket_id, product_id, name, unit_price, qty)
        values (${ticketId}, ${line.productId}, ${line.name}, ${line.unitPrice}, ${line.qty})
      `;
    }
    const stored = await sql<ItemRow>`
      select id, ticket_id, product_id, name, unit_price, qty
      from ticket_items where ticket_id = ${ticketId} order by id
    `;
    return {
      id: ticketId,
      tableName: "Bar",
      kind: "bar",
      startedAt: nowIso,
      endedAt: nowIso,
      elapsedLabel: "00:00:00",
      hourlyRate: 0,
      timeCharge: 0,
      items: stored.map(mapItem),
      itemsTotal,
      total: itemsTotal,
      payMethod: data.payMethod,
    };
  });

export const getReport = createServerFn({ method: "GET" })
  .validator(z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
  .handler(async ({ data }): Promise<ReportPayload> => {
    const sql = await getSql();
    const { start, end } = dayBounds(data.day);
    const tickets = await sql.query<
      TicketRow & { table_name: string | null }
    >(
      `select t.id, t.table_id, t.kind, t.started_at, t.ended_at, t.hourly_rate,
              t.time_charge, t.items_total, t.total, t.pay_method, t.status,
              c.name as table_name
       from tickets t
       left join club_tables c on c.id = t.table_id
       where t.status = 'closed'
         and t.ended_at >= $1::timestamptz and t.ended_at < $2::timestamptz
       order by t.ended_at desc`,
      [start, end],
    );
    const ids = tickets.map((t) => t.id);
    let items: ItemRow[] = [];
    if (ids.length > 0) {
      items = await sql.query<ItemRow>(
        `select id, ticket_id, product_id, name, unit_price, qty
         from ticket_items where ticket_id = any($1::int[])`,
        [ids],
      );
    }

    const byPay = { naqd: 0, karta: 0 };
    const byKind = { table: 0, bar: 0 };
    let tableMs = 0;
    const hourlyMap = new Map<string, number>();
    for (let h = 0; h < 24; h += 1) {
      hourlyMap.set(String(h).padStart(2, "0"), 0);
    }
    for (const ticket of tickets) {
      const pay = asPay(ticket.pay_method);
      byPay[pay] += ticket.total;
      if (ticket.kind === "bar") byKind.bar += ticket.total;
      else byKind.table += ticket.total;
      if (ticket.kind === "table") {
        tableMs += elapsedMs(iso(ticket.started_at), Date.parse(iso(ticket.ended_at)));
      }
      const ended = new Date(iso(ticket.ended_at));
      const hour = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Tashkent",
        hour: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(ended)
        .find((part) => part.type === "hour")?.value
        ?.padStart(2, "0") ?? "00";
      hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + ticket.total);
    }

    const productMap = new Map<string, { qty: number; total: number }>();
    for (const item of items) {
      const cur = productMap.get(item.name) ?? { qty: 0, total: 0 };
      cur.qty += item.qty;
      cur.total += item.unit_price * item.qty;
      productMap.set(item.name, cur);
    }
    const topProducts = [...productMap.entries()]
      .map(([name, v]) => ({ name, qty: v.qty, total: v.total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    return {
      day: data.day,
      tickets: tickets.map((t) => ({
        id: t.id,
        tableName: t.table_name,
        kind: t.kind,
        endedAt: iso(t.ended_at),
        timeCharge: t.time_charge,
        itemsTotal: t.items_total,
        total: t.total,
        payMethod: t.pay_method ? asPay(t.pay_method) : null,
      })),
      byPay,
      byKind,
      topProducts,
      hourly: [...hourlyMap.entries()].map(([hour, total]) => ({ hour, total })),
      sessionCount: tickets.length,
      tableHours: Math.round((tableMs / 3_600_000) * 10) / 10,
    };
  });

export const getCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ tables: CatalogTable[]; products: Product[] }> => {
    const sql = await getSql();
    const [tables, products] = await Promise.all([
      sql<TableRow>`
        select id, name, kind, hourly_rate, sort_order, active
        from club_tables
        order by sort_order, id
      `,
      sql<ProductRow>`
        select id, name, category, price, sort_order, active
        from products
        order by sort_order, id
      `,
    ]);
    return {

      tables: tables.map((t) => ({
        id: t.id,
        name: t.name,
        kind: asKind(t.kind),
        hourlyRate: t.hourly_rate,
        sortOrder: t.sort_order,
        active: t.active,
      })),
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        category: asCategory(p.category),
        price: p.price,
        sortOrder: p.sort_order,
        active: p.active,
      })),
    };
  },
);

export const saveTable = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.number().int().positive().optional(),
      name: z.string().trim().min(1).max(40),
      kind: z.enum(["rus", "pool", "snooker"]),
      hourlyRate: z.number().int().min(1000).max(5_000_000),
      active: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    if (data.id) {
      await sql`
        update club_tables
        set name = ${data.name},
            kind = ${data.kind},
            hourly_rate = ${data.hourlyRate},
            active = ${data.active}
        where id = ${data.id}
      `;
      return { id: data.id };
    }
    const max = await sql<{ n: number }>`
      select coalesce(max(sort_order), 0)::int as n from club_tables
    `;
    const inserted = await sql<{ id: number }>`
      insert into club_tables (name, kind, hourly_rate, sort_order, active)
      values (${data.name}, ${data.kind}, ${data.hourlyRate}, ${(max[0]?.n ?? 0) + 1}, ${data.active})
      returning id
    `;
    return { id: inserted[0]?.id ?? 0 };
  });

export const saveProduct = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.number().int().positive().optional(),
      name: z.string().trim().min(1).max(40),
      category: z.enum(["ichimlik", "gazak"]),
      price: z.number().int().min(500).max(5_000_000),
      active: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    if (data.id) {
      await sql`
        update products
        set name = ${data.name},
            category = ${data.category},
            price = ${data.price},
            active = ${data.active}
        where id = ${data.id}
      `;
      return { id: data.id };
    }
    const max = await sql<{ n: number }>`
      select coalesce(max(sort_order), 0)::int as n from products
    `;
    const inserted = await sql<{ id: number }>`
      insert into products (name, category, price, sort_order, active)
      values (${data.name}, ${data.category}, ${data.price}, ${(max[0]?.n ?? 0) + 1}, ${data.active})
      returning id
    `;
    return { id: inserted[0]?.id ?? 0 };
  });

export type MonthlyDayRow = {
  day: string;
  total: number;
  naqd: number;
  karta: number;
  sessions: number;
};

export type MonthlyPayload = {
  month: string; // "YYYY-MM"
  days: MonthlyDayRow[];
  totalRevenue: number;
  totalNaqd: number;
  totalKarta: number;
  totalSessions: number;
};

export const getMonthlyReport = createServerFn({ method: "GET" })
  .validator(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
  .handler(async ({ data }): Promise<MonthlyPayload> => {
    const sql = await getSql();
    const [year, mon] = data.month.split("-").map(Number);
    const start = new Date(`${data.month}-01T00:00:00+05:00`);
    const endMonth = new Date(start);
    endMonth.setMonth(endMonth.getMonth() + 1);
    const startIso = start.toISOString();
    const endIso = endMonth.toISOString();

    const rows = await sql.query<{
      day: string;
      total: string;
      naqd: string;
      karta: string;
      sessions: string;
    }>(
      `select
         to_char(ended_at at time zone 'Asia/Tashkent', 'YYYY-MM-DD') as day,
         coalesce(sum(total), 0)::bigint as total,
         coalesce(sum(case when pay_method = 'naqd' then total else 0 end), 0)::bigint as naqd,
         coalesce(sum(case when pay_method = 'karta' then total else 0 end), 0)::bigint as karta,
         count(*)::int as sessions
       from tickets
       where status = 'closed'
         and ended_at >= $1::timestamptz
         and ended_at <  $2::timestamptz
       group by 1
       order by 1`,
      [startIso, endIso],
    );

    // Build full calendar for the month (fill missing days with zeros)
    const daysInMonth = new Date((year ?? 2000), (mon ?? 1), 0).getDate();
    const byDay = new Map(rows.map((r) => [r.day, r]));
    const days: MonthlyDayRow[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${data.month}-${String(d).padStart(2, "0")}`;
      const row = byDay.get(key);
      days.push({
        day: key,
        total: row ? Number(row.total) : 0,
        naqd: row ? Number(row.naqd) : 0,
        karta: row ? Number(row.karta) : 0,
        sessions: row ? Number(row.sessions) : 0,
      });
    }

    const totalRevenue = days.reduce((s, d) => s + d.total, 0);
    const totalNaqd = days.reduce((s, d) => s + d.naqd, 0);
    const totalKarta = days.reduce((s, d) => s + d.karta, 0);
    const totalSessions = days.reduce((s, d) => s + d.sessions, 0);

    return { month: data.month, days, totalRevenue, totalNaqd, totalKarta, totalSessions };
  });

// ── Offline Sync Server Functions ────────────────────────────────────────────
// Called by SyncEngine when the device comes back online.

const syncItemsInput = z.array(
  z.object({
    productId: z.number().int().positive().nullable(),
    name: z.string().min(1).max(80),
    unitPrice: z.number().int().min(0),
    qty: z.number().int().positive().max(999),
  }),
);


/**
 * Create an OPEN session on the server for a session that started offline.
 * Returns the new server-assigned ticketId.
 */
export const syncOpenSession = createServerFn({ method: "POST" })
  .validator(
    z.object({
      tableId: z.number().int().positive(),
      startedAt: z.string(),
      hourlyRate: z.number().int().min(0),
      items: syncItemsInput,
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const inserted = await sql<{ id: number }>`
      insert into tickets (table_id, kind, started_at, hourly_rate, status)
      values (${data.tableId}, 'table', ${data.startedAt}::timestamptz, ${data.hourlyRate}, 'open')
      returning id
    `;
    const ticketId = inserted[0]?.id;
    if (!ticketId) throw new Error("Seans ochilmadi");
    for (const item of data.items) {
      await sql`
        insert into ticket_items (ticket_id, product_id, name, unit_price, qty)
        values (${ticketId}, ${item.productId}, ${item.name}, ${item.unitPrice}, ${item.qty})
      `;
    }
    return { ticketId };
  });

/**
 * Write a fully CLOSED session that started and ended while offline.
 */
export const syncClosedSession = createServerFn({ method: "POST" })
  .validator(
    z.object({
      tableId: z.number().int().positive(),
      startedAt: z.string(),
      endedAt: z.string(),
      hourlyRate: z.number().int().min(0),
      timeCharge: z.number().int().min(0),
      itemsTotal: z.number().int().min(0),
      total: z.number().int().min(0),
      payMethod: z.enum(["naqd", "karta"]),
      items: syncItemsInput,
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const inserted = await sql<{ id: number }>`
      insert into tickets (
        table_id, kind, started_at, ended_at, hourly_rate,
        time_charge, items_total, total, pay_method, status
      ) values (
        ${data.tableId}, 'table',
        ${data.startedAt}::timestamptz, ${data.endedAt}::timestamptz,
        ${data.hourlyRate}, ${data.timeCharge}, ${data.itemsTotal},
        ${data.total}, ${data.payMethod}, 'closed'
      )
      returning id
    `;
    const ticketId = inserted[0]?.id;
    if (!ticketId) throw new Error("Chek yozilmadi");
    for (const item of data.items) {
      await sql`
        insert into ticket_items (ticket_id, product_id, name, unit_price, qty)
        values (${ticketId}, ${item.productId}, ${item.name}, ${item.unitPrice}, ${item.qty})
      `;
    }
    return { ticketId };
  });

/**
 * Force-close an existing OPEN session with an explicit final state.
 * Used when an online session was closed while the device was offline.
 * Replaces all items and sets the closed fields in one transaction.
 */
export const forceCloseSession = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ticketId: z.number().int().positive(),
      payMethod: z.enum(["naqd", "karta"]),
      endedAt: z.string(),
      timeCharge: z.number().int().min(0),
      itemsTotal: z.number().int().min(0),
      total: z.number().int().min(0),
      items: syncItemsInput,
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from ticket_items where ticket_id = ${data.ticketId}`;
    for (const item of data.items) {
      await sql`
        insert into ticket_items (ticket_id, product_id, name, unit_price, qty)
        values (${data.ticketId}, ${item.productId}, ${item.name}, ${item.unitPrice}, ${item.qty})
      `;
    }
    await sql`
      update tickets
      set ended_at    = ${data.endedAt}::timestamptz,
          time_charge = ${data.timeCharge},
          items_total = ${data.itemsTotal},
          total       = ${data.total},
          pay_method  = ${data.payMethod},
          status      = 'closed'
      where id = ${data.ticketId} and status = 'open'
    `;
    return { ticketId: data.ticketId };
  });

/**
 * Replace all items on an OPEN session.
 * Used when the device reconnects with a session still open but items changed offline.
 */
export const syncDirtySessionItems = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ticketId: z.number().int().positive(),
      items: syncItemsInput,
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from ticket_items where ticket_id = ${data.ticketId}`;
    for (const item of data.items) {
      await sql`
        insert into ticket_items (ticket_id, product_id, name, unit_price, qty)
        values (${data.ticketId}, ${item.productId}, ${item.name}, ${item.unitPrice}, ${item.qty})
      `;
    }
    return { ok: true as const };
  });

