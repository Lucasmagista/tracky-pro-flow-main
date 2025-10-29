-- SQL Script to add onboarding fields to profiles table
-- Execute this in Supabase SQL Editor

-- Add onboarding_completed column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Add store contact information columns
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS store_email TEXT,
ADD COLUMN IF NOT EXISTS store_phone TEXT,
ADD COLUMN IF NOT EXISTS store_address TEXT;

-- Update existing profiles to have onboarding_completed = false if null
UPDATE public.profiles
SET onboarding_completed = FALSE
WHERE onboarding_completed IS NULL;