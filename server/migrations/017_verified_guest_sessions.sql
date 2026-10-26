-- Operational guest credentials must originate from a completed OTP challenge.
-- Existing records remain intact; credentials without verification require reauthentication.
ALTER TABLE public.guest_session_tokens
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ NULL;
