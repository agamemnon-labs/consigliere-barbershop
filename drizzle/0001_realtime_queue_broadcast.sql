-- Live queue: tell every screen of a branch that its queue changed.
-- Supabase Realtime "Broadcast from Database". The payload carries no customer
-- data, only the branch and the time, so the channel can be public; screens
-- refetch through the server. Without Supabase (demo PGlite) the call is a no-op.
CREATE OR REPLACE FUNCTION public.broadcast_queue_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  target_branch uuid := COALESCE(NEW.branch_id, OLD.branch_id);
BEGIN
  IF target_branch IS NOT NULL THEN
    BEGIN
      PERFORM realtime.send(
        jsonb_build_object('branchId', target_branch, 'at', now()),
        'changed',
        'queue:' || target_branch::text,
        false
      );
    EXCEPTION WHEN undefined_function OR invalid_schema_name THEN
      NULL;
    END;
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER queue_entries_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.queue_entries
FOR EACH ROW EXECUTE FUNCTION public.broadcast_queue_change();
--> statement-breakpoint
CREATE TRIGGER barber_shifts_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.barber_shifts
FOR EACH ROW EXECUTE FUNCTION public.broadcast_queue_change();
