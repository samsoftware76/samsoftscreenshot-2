-- ==========================================
-- MULTITENANT PRODUCTION SCHEMA (MIGRATION-SAFE)
-- ==========================================

-- PHASE 0: PRE-FLIGHT MIGRATIONS (Ensure columns exist for policies)
DO $$ 
BEGIN 
    -- Profiles Missing Columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='is_admin') THEN
        ALTER TABLE public.profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='credits') THEN
        ALTER TABLE public.profiles ADD COLUMN credits INTEGER DEFAULT 10;
    END IF;

    -- Profiles Backfill (Create rows for existing auth.users)
    INSERT INTO public.profiles (id, email, full_name)
    SELECT id, email, raw_user_meta_data->>'full_name'
    FROM auth.users
    ON CONFLICT (id) DO NOTHING;

    -- Chat Messages Missing Columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='chat_messages' AND column_name='organization_id') THEN
        ALTER TABLE public.chat_messages ADD COLUMN organization_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='chat_messages' AND column_name='mode') THEN
        ALTER TABLE public.chat_messages ADD COLUMN mode TEXT DEFAULT 'general';
    END IF;

    -- Pesapal Transactions Missing Columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pesapal_transactions' AND column_name='organization_id') THEN
        ALTER TABLE public.pesapal_transactions ADD COLUMN organization_id UUID;
    END IF;
END $$;


-- 1. Organizations (Tenants)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    billing_status TEXT DEFAULT 'trial' CHECK (billing_status IN ('trial', 'active', 'past_due', 'canceled'))
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    credits INTEGER DEFAULT 10
);


-- 3. Organization Members (Multitenancy Junction)
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(organization_id, user_id)
);

-- 4. Chat Sessions (to track multiple conversations)
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'New Conversation',
    mode TEXT DEFAULT 'general'
);

-- 5. Chat Messages (With History & Tenant Isolation)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    mode TEXT DEFAULT 'general',
    metadata JSONB DEFAULT '{}'::jsonb
);


-- 6. Pesapal Transactions
CREATE TABLE IF NOT EXISTS public.pesapal_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    order_tracking_id TEXT UNIQUE,
    merchant_reference TEXT UNIQUE NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'PENDING',
    payment_method TEXT,
    description TEXT
);

-- 7. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'SUBSCRIPTION_SUCCESS', 'CREDIT_LOW', 'SYSTEM'
    recipient_email TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE
);


-- ==========================================
-- ENABLE RLS
-- ==========================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesapal_transactions ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS POLICIES (DROP AND RECREATE FOR IDEMPOTENCY)
-- ==========================================

DROP POLICY IF EXISTS "Members can view their organization" ON public.organizations;
CREATE POLICY "Members can view their organization" ON public.organizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.organization_members 
            WHERE organization_id = public.organizations.id 
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;
CREATE POLICY "Users can create organizations" ON public.organizations
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;
CREATE POLICY "Users can manage their own profile" ON public.profiles
    FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view their own memberships" ON public.organization_members;
CREATE POLICY "Users can view their own memberships" ON public.organization_members
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.chat_sessions;
CREATE POLICY "Users can manage their own sessions" ON public.chat_sessions
    FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their session messages" ON public.chat_messages;
CREATE POLICY "Users can manage their session messages" ON public.chat_messages
    FOR ALL USING (
        user_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM public.chat_sessions WHERE id = session_id AND user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can view their organization transactions" ON public.pesapal_transactions;
CREATE POLICY "Users can view their organization transactions" ON public.pesapal_transactions
    FOR SELECT USING (
        user_id = auth.uid() OR
        organization_id IN (
            SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

-- ==========================================
-- AUTOMATION
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Auto-create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

DROP POLICY IF EXISTS "Admins can view all transactions" ON public.pesapal_transactions;
CREATE POLICY "Admins can view all transactions" ON public.pesapal_transactions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "Admins can view all memberships" ON public.organization_members;
CREATE POLICY "Admins can view all memberships" ON public.organization_members
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_org ON public.chat_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_pesapal_reference ON public.pesapal_transactions(merchant_reference);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Credit Management RPC
CREATE OR REPLACE FUNCTION public.decrement_credits(user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET credits = credits - 1
    WHERE id = user_id AND credits > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.add_credits(user_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET credits = credits + amount
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
