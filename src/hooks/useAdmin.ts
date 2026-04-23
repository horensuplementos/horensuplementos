import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [permissionLevel, setPermissionLevel] = useState<"admin" | "operator" | "editor" | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setIsAdmin(false);
        setPermissionLevel(null);
        setLoading(false);
        return;
      }

      setUserId(session.user.id);

      const { data } = await (supabase as any)
        .from("admin_profiles")
        .select("permission_level, active")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const isActiveAdmin = !!data?.active;
      setPermissionLevel(isActiveAdmin ? data.permission_level : null);
      setIsAdmin(isActiveAdmin);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAdmin();
    });

    checkAdmin();
    return () => subscription.unsubscribe();
  }, []);

  return { isAdmin, loading, userId, permissionLevel };
};
