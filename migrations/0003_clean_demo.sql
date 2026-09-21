-- Remove all demo/test tickets that were pre-seeded.
-- Safe to run multiple times: only deletes rows that exist.
delete from ticket_items
where ticket_id in (select id from tickets);

delete from tickets;
