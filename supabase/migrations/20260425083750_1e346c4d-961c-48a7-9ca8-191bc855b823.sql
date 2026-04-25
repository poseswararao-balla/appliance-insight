-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- appliances
CREATE TABLE public.appliances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appliance_type TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  age_years NUMERIC NOT NULL DEFAULT 0,
  daily_usage_hours NUMERIC NOT NULL DEFAULT 0,
  power_rating_watts NUMERIC,
  electricity_rate NUMERIC NOT NULL DEFAULT 0.15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.appliances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appliances_select_own" ON public.appliances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "appliances_insert_own" ON public.appliances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "appliances_update_own" ON public.appliances FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "appliances_delete_own" ON public.appliances FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER appliances_updated_at BEFORE UPDATE ON public.appliances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_appliances_user ON public.appliances(user_id);

-- analyses
CREATE TABLE public.analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appliance_id UUID NOT NULL REFERENCES public.appliances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  efficiency_loss_pc NUMERIC NOT NULL,
  current_power_w NUMERIC NOT NULL,
  monthly_kwh NUMERIC NOT NULL,
  monthly_cost NUMERIC NOT NULL,
  monthly_extra_cost NUMERIC NOT NULL,
  health_score NUMERIC NOT NULL,
  remaining_life_years NUMERIC NOT NULL,
  five_year_cost NUMERIC NOT NULL,
  confidence TEXT NOT NULL,
  match_method TEXT NOT NULL,
  future_trend JSONB NOT NULL,
  recommendations JSONB NOT NULL,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analyses_select_own" ON public.analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "analyses_insert_own" ON public.analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "analyses_delete_own" ON public.analyses FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_analyses_appliance ON public.analyses(appliance_id);
CREATE INDEX idx_analyses_user ON public.analyses(user_id);

-- appliance catalog (public read for authenticated users)
CREATE TABLE public.appliance_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appliance_type TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  power_rating_watts NUMERIC NOT NULL,
  max_life_years NUMERIC NOT NULL,
  energy_star BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.appliance_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog_read_authenticated" ON public.appliance_catalog FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_catalog_type ON public.appliance_catalog(appliance_type);
CREATE INDEX idx_catalog_brand ON public.appliance_catalog(brand);