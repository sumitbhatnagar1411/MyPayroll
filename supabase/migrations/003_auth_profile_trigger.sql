-- Auto-create profile when auth user is created
-- Note: profiles table has no unique constraint on id (it's PK), so ON CONFLICT won't apply.
-- Use INSERT ... ON CONFLICT only if profiles has a unique/primary key. Since id is PK, a duplicate
-- insert would fail - so we use INSERT and ignore errors, or ensure one insert per user.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'employee');
EXCEPTION
  WHEN unique_violation THEN NULL;  -- profile already exists
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- To make your first admin: sign up at /login, then run:
-- UPDATE profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
