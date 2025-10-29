-- Migration: Add email columns to profiles
-- Description: Add email and phone columns to profiles table for easier queries
-- Created: 2025-01-27

-- Add email column to profiles (synced from auth.users)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Add store_email column (if not exists)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS store_email TEXT;

-- Add store_phone column (if not exists)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS store_phone TEXT;

-- Add store_address column (if not exists)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS store_address TEXT;

-- Add avatar_url column (if not exists)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add onboarding_completed column (if not exists)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Create function to sync email from auth.users to profiles
CREATE OR REPLACE FUNCTION public.sync_user_email()
RETURNS TRIGGER AS $$
BEGIN
  -- When a user is created in auth.users, update their profile with email
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) 
  DO UPDATE SET email = NEW.email;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically sync email
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_email();

-- Update existing profiles with email from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
AND p.email IS NULL;

-- Create index on email for faster searches
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Grant permissions
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;

-- Verify columns were added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'email'
  ) THEN
    RAISE NOTICE 'Email column successfully added to profiles';
  ELSE
    RAISE EXCEPTION 'Failed to add email column to profiles';
  END IF;
END $$;
