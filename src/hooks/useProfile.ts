import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Profile {
  name: string;
  store_name: string;
  avatar_url: string;
  store_email: string;
  store_phone: string;
  store_address: string;
  email: string;
  created_at: string;
}

export interface ProfileStats {
  totalOrders: number;
  notificationsSent: number;
  accountAge: number;
  lastActivity: string;
}

export const useProfile = (userId: string | undefined) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [profile, setProfile] = useState<Profile>({
    name: "",
    store_name: "",
    avatar_url: "",
    store_email: "",
    store_phone: "",
    store_address: "",
    email: "",
    created_at: "",
  });
  const [stats, setStats] = useState<ProfileStats>({
    totalOrders: 0,
    notificationsSent: 0,
    accountAge: 0,
    lastActivity: "",
  });

  const loadProfile = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const { data: userData } = await supabase.auth.getUser();
        setProfile({
          name: data.name || "",
          store_name: data.store_name || "",
          avatar_url: data.avatar_url || "",
          store_email: data.store_email || "",
          store_phone: data.store_phone || "",
          store_address: data.store_address || "",
          email: userData?.user?.email || "",
          created_at: data.created_at || "",
        });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast({
        title: "Erro ao carregar perfil",
        description: "Não foi possível carregar seus dados.",
        variant: "destructive",
      });
    }
  }, [userId, toast]);

  const loadStats = useCallback(async () => {
    if (!userId) return;

    setStatsLoading(true);
    try {
      // Count total orders
      const { count: ordersCount } = await supabase
        .from("orders")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", userId);

      // Count notifications sent
      const { count: notificationsCount } = await supabase
        .from("logs")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", userId)
        .like("action", "%notification%");

      // Get last activity
      const { data: lastLog } = await supabase
        .from("logs")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Calculate account age
      const { data: profileData } = await supabase
        .from("profiles")
        .select("created_at")
        .eq("id", userId)
        .single();

      const accountAgeInDays = profileData?.created_at
        ? Math.floor((new Date().getTime() - new Date(profileData.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      setStats({
        totalOrders: ordersCount || 0,
        notificationsSent: notificationsCount || 0,
        accountAge: accountAgeInDays,
        lastActivity: lastLog?.created_at || "",
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setStatsLoading(false);
    }
  }, [userId]);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!userId) return false;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: userId,
          ...updates,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Log profile update
      await supabase.from("logs").insert({
        user_id: userId,
        action: "profile_updated",
        details: { 
          timestamp: new Date().toISOString(),
          fields_updated: Object.keys(updates)
        }
      });

      setProfile(prev => ({ ...prev, ...updates }));
      
      toast({
        title: "Perfil atualizado!",
        description: "Suas informações foram salvas com sucesso.",
      });

      return true;
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar suas alterações. Tente novamente.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  const updateAvatar = useCallback(async (avatarUrl: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", userId);

      if (error) throw error;

      // Log avatar update activity
      await supabase.from("logs").insert({
        user_id: userId,
        action: avatarUrl ? "avatar_uploaded" : "avatar_removed",
        details: { timestamp: new Date().toISOString() }
      });

      setProfile(prev => ({ ...prev, avatar_url: avatarUrl }));
    } catch (error) {
      console.error("Error updating avatar:", error);
      throw error;
    }
  }, [userId]);

  const validateProfile = useCallback((profileData: Partial<Profile>) => {
    const errors: string[] = [];

    if (profileData.store_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileData.store_email)) {
      errors.push("Email da loja inválido");
    }

    if (profileData.store_phone && !/^[\d\s()+-]+$/.test(profileData.store_phone)) {
      errors.push("Telefone da loja inválido");
    }

    if (errors.length > 0) {
      toast({
        title: "Dados inválidos",
        description: errors.join(", "),
        variant: "destructive",
      });
      return false;
    }

    return true;
  }, [toast]);

  const getCompletionPercentage = useCallback(() => {
    const fields = [
      profile.name,
      profile.store_name,
      profile.store_email,
      profile.store_phone,
      profile.store_address,
      profile.avatar_url,
    ];
    const filledFields = fields.filter(field => field && field.trim() !== "").length;
    return Math.round((filledFields / fields.length) * 100);
  }, [profile]);

  return {
    profile,
    setProfile,
    stats,
    loading,
    statsLoading,
    loadProfile,
    loadStats,
    updateProfile,
    updateAvatar,
    validateProfile,
    getCompletionPercentage,
  };
};
