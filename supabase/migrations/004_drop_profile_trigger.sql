-- Remove trigger that may cause "Database error creating new user" on signup
-- Profile creation is now handled by /api/auth/ensure-profile (called after signup/login)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
