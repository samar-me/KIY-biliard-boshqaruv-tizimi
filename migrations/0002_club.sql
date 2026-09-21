-- KIY billiard club: tables, products, tickets. Unowned operational rows.
create table if not exists club_tables (
  id           serial primary key,
  name         text not null,
  kind         text not null default 'pool',
  hourly_rate  integer not null,
  sort_order   integer not null default 0,
  active       boolean not null default true
);

create table if not exists products (
  id           serial primary key,
  name         text not null,
  category     text not null default 'ichimlik',
  price        integer not null,
  sort_order   integer not null default 0,
  active       boolean not null default true
);

create table if not exists tickets (
  id           serial primary key,
  table_id     integer references club_tables(id),
  kind         text not null default 'table',
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  hourly_rate  integer not null default 0,
  time_charge  integer not null default 0,
  items_total  integer not null default 0,
  total        integer not null default 0,
  pay_method   text,
  status       text not null default 'open'
);

create table if not exists ticket_items (
  id           serial primary key,
  ticket_id    integer not null references tickets(id),
  product_id   integer references products(id),
  name         text not null,
  unit_price   integer not null,
  qty          integer not null default 1,
  created_at   timestamptz not null default now()
);

create index if not exists tickets_open_table_idx
  on tickets (table_id, status);
create index if not exists tickets_closed_ended_idx
  on tickets (status, ended_at);
create index if not exists ticket_items_ticket_idx
  on ticket_items (ticket_id);

insert into club_tables (name, kind, hourly_rate, sort_order)
select v.name, v.kind, v.hourly_rate, v.sort_order
from (
  values
    ('Rus 1', 'rus', 25000, 1),
    ('Rus 2', 'rus', 25000, 2),
    ('Rus 3', 'rus', 25000, 3),
    ('Amerikan 1', 'pool', 20000, 4),
    ('Amerikan 2', 'pool', 20000, 5),
    ('Amerikan 3', 'pool', 20000, 6)
) as v(name, kind, hourly_rate, sort_order)
where not exists (select 1 from club_tables limit 1);

insert into products (name, category, price, sort_order)
select v.name, v.category, v.price, v.sort_order
from (
  values
    ('Qora choy', 'ichimlik', 4000, 1),
    ('Ko''k choy', 'ichimlik', 4000, 2),
    ('Kofe', 'ichimlik', 12000, 3),
    ('Cola 0.5', 'ichimlik', 8000, 4),
    ('Fanta 0.5', 'ichimlik', 8000, 5),
    ('Suv 0.5', 'ichimlik', 4000, 6),
    ('Energetik', 'ichimlik', 15000, 7),
    ('Chips', 'gazak', 10000, 8),
    ('Yong''oq', 'gazak', 12000, 9),
    ('Shokolad', 'gazak', 8000, 10)
) as v(name, category, price, sort_order)
where not exists (select 1 from products limit 1);

