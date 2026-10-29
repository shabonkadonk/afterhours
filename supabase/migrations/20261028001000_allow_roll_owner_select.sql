-- The owner must be allowed to read a newly inserted roll's RETURNING row.
-- Membership is created by an AFTER INSERT trigger, so this owner check also
-- covers the short point before that membership row is visible.
create policy "Owners can view their own rolls" on public.rolls
for select to authenticated using (owner_id = (select auth.uid()));
