-- Analisi storica Gmail dal gennaio 2024, separata dal controllo incrementale corrente.
-- I messaggi restano deduplicati dalla chiave gmail_message_id.
ALTER TABLE public.gw_payment_sync_state
  DROP CONSTRAINT IF EXISTS gw_payment_sync_state_source_check;
ALTER TABLE public.gw_payment_sync_state
  ADD CONSTRAINT gw_payment_sync_state_source_check
  CHECK (source IN ('gmail_payments','gmail_payments_history_2024') OR source LIKE 'ticket_tailor:%');
