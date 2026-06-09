ALTER TABLE user_event_enrollments ADD COLUMN IF NOT EXISTS partner_email text;
ALTER TABLE user_event_enrollments ADD COLUMN IF NOT EXISTS partner_name text;

CREATE POLICY "Users can update own enrollments"
ON user_event_enrollments
FOR UPDATE
USING (auth.uid() = profile_id)
WITH CHECK (auth.uid() = profile_id);
