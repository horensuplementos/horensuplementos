import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AdminPermissionLevel = "admin" | "operator" | "editor" | null;

export const useAdminPermissions = () => {
  const [permissionLevel, setPermissionLevel] = useState<AdminPermissionLevel>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const resolvePermissions = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        setPermissionLevel(null);
        setLoading(false);
        return;
      }

      const { data } = await (supabase as any)
        .from("admin_profiles")
        .select("permission_level, active")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.active) {
        setPermissionLevel(data.permission_level as AdminPermissionLevel);
        setLoading(false);
        return;
      }

      const { data: hasLegacyAdminRole } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });

      setPermissionLevel(hasLegacyAdminRole ? "admin" : null);
      setLoading(false);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      resolvePermissions();
    });

    resolvePermissions();
    return () => authListener.subscription.unsubscribe();
  }, []);

  return {
    permissionLevel,
    loading,
    isAdminManager: permissionLevel === "admin",
    canManageOrders: permissionLevel === "admin" || permissionLevel === "operator",
    canManageContent: permissionLevel === "admin" || permissionLevel === "editor",
  };
};