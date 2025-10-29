-- Add onboarding_completed column to profiles table
ALTER TABLE public.profiles
ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;

-- Add store contact information columns
ALTER TABLE public.profiles
ADD COLUMN store_email TEXT,
ADD COLUMN store_phone TEXT,
ADD COLUMN store_address TEXT;