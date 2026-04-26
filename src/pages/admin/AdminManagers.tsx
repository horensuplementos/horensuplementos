import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, UserPlus, UserX, Mail, Copy, Send } from "lucide-react";

type PermissionLevel = "admin" | "operator" | "editor";

type AdminProfile = {
  id: string;
  user_id: string;
  email: string;
  permission_level: PermissionLevel;
  active: boolean;
  invited_by: string | null;
  updated_at: string;
};

type AdminInvitation = {
  id: string;
  email: string;
  permission_level: PermissionLevel;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  invite_token?: string | null;
};

const AdminManagers = () => {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [invitations, setInvitations] = useState<AdminInvitation[]>([]);
  const [email, setEmail] = useState("");
  const [permissionLevel, setPermissionLevel] = useState<PermissionLevel>("editor");
  const [saving, setSaving] = useState(false);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);

  const buildAcceptUrl = (token: string) =>
    `${window.location.origin}/aceitar-convite?token=${token}`;

  const sendInviteEmail = async (invitationId: string): Promise<{ ok: boolean; acceptUrl?: string; error?: string }> => {
    const { data, error } = await supabase.functions.invoke("send-admin-invite", {
      body: { invitation_id: invitationId },
    });
    if (error) return { ok: false, error: error.message };
    if (data?.error) return { ok: false, error: data.error, acceptUrl: data.accept_url };
    return { ok: true, acceptUrl: data?.accept_url };
  };

  const fetchData = async () => {
    const [profilesRes, invitationsRes] = await Promise.all([
      (supabase as any).from("admin_profiles").select("*").order("email"),
      (supabase as any).from("admin_invitations").select("*").order("created_at", { ascending: false }),
    ]);

    if (profilesRes.error || invitationsRes.error) {
      toast({
        title: "Erro ao carregar administradores",
        description: profilesRes.error?.message || invitationsRes.error?.message,
        variant: "destructive",
      });
      return;
    }

    setProfiles((profilesRes.data || []) as AdminProfile[]);
    setInvitations((invitationsRes.data || []) as AdminInvitation[]);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const pendingInvites = useMemo(
    () => invitations.filter((invite) => !invite.accepted_at && !invite.revoked_at),
    [invitations]
  );

  const sendInvitation = async () => {
    if (!email.trim()) return;
    setSaving(true);

    const { data: inserted, error } = await (supabase as any)
      .from("admin_invitations")
      .insert({
        email: email.trim().toLowerCase(),
        permission_level: permissionLevel,
      })
      .select("id, invite_token")
      .single();

    if (error) {
      setSaving(false);
      const dup = (error as any).code === "23505";
      toast({
        title: dup ? "Já existe um convite ativo para este e-mail" : "Erro ao criar convite",
        description: dup ? "Revogue o convite existente antes de criar um novo." : error.message,
        variant: "destructive",
      });
      return;
    }

    // Send email with invite link
    const result = await sendInviteEmail(inserted.id);
    setSaving(false);

    if (result.ok) {
      toast({
        title: "Convite enviado por e-mail",
        description: `${email.trim()} receberá o link de aceite em instantes.`,
      });
    } else {
      const link = result.acceptUrl || (inserted.invite_token ? buildAcceptUrl(inserted.invite_token) : "");
      toast({
        title: "Convite criado, mas o e-mail falhou",
        description: link
          ? `Compartilhe este link manualmente: ${link}`
          : result.error || "Tente reenviar pelo botão na lista.",
        variant: "destructive",
      });
    }
    setEmail("");
    setPermissionLevel("editor");
    fetchData();
  };

  const resendInvite = async (invitation: AdminInvitation) => {
    setBusyInviteId(invitation.id);
    const result = await sendInviteEmail(invitation.id);
    setBusyInviteId(null);
    if (result.ok) {
      toast({ title: "Convite reenviado", description: `Link enviado para ${invitation.email}.` });
    } else {
      toast({ title: "Falha ao reenviar", description: result.error, variant: "destructive" });
    }
  };

  const copyInviteLink = async (invitation: AdminInvitation) => {
    if (!invitation.invite_token) {
      toast({ title: "Link indisponível", variant: "destructive" });
      return;
    }
    const url = buildAcceptUrl(invitation.invite_token);
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado", description: url });
    } catch {
      toast({ title: "Copie manualmente", description: url });
    }
  };

  const updateProfile = async (profile: AdminProfile, nextLevel: PermissionLevel) => {
    const { error } = await (supabase as any)
      .from("admin_profiles")
      .update({ permission_level: nextLevel })
      .eq("id", profile.id);

    if (error) {
      toast({ title: "Erro ao atualizar permissão", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Permissão atualizada" });
    fetchData();
  };

  const toggleProfile = async (profile: AdminProfile) => {
    const { error } = await (supabase as any)
      .from("admin_profiles")
      .update({ active: !profile.active })
      .eq("id", profile.id);

    if (error) {
      toast({ title: "Erro ao atualizar acesso", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: profile.active ? "Acesso removido" : "Acesso reativado" });
    fetchData();
  };

  const revokeInvitation = async (invitationId: string) => {
    const { error } = await (supabase as any)
      .from("admin_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", invitationId);

    if (error) {
      toast({ title: "Erro ao revogar convite", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Convite revogado" });
    fetchData();
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Administradores</h1>
          <p className="mt-1 text-sm text-muted-foreground">Convide pessoas, defina níveis de acesso e desative acessos quando necessário.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Novo convite</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto]">
            <Input placeholder="email@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Select value={permissionLevel} onValueChange={(value) => setPermissionLevel(value as PermissionLevel)}>
              <SelectTrigger>
                <SelectValue placeholder="Nível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="operator">Operador</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={sendInvitation} disabled={saving || !email.trim()} className="gap-2">
              <UserPlus className="h-4 w-4" /> {saving ? "Salvando..." : "Convidar"}
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Equipe com acesso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum administrador cadastrado.</p>
              ) : (
                profiles.map((profile) => (
                  <div key={profile.id} className="rounded-md border border-border bg-secondary/30 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="font-medium text-foreground">{profile.email}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className={`rounded-full px-2 py-1 ${profile.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                            {profile.active ? "Ativo" : "Inativo"}
                          </span>
                          <span className="rounded-full bg-card px-2 py-1 capitalize">{profile.permission_level}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Select value={profile.permission_level} onValueChange={(value) => updateProfile(profile, value as PermissionLevel)}>
                          <SelectTrigger className="w-[170px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="operator">Operador</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant={profile.active ? "destructive" : "secondary"} onClick={() => toggleProfile(profile)} className="gap-2">
                          <UserX className="h-4 w-4" /> {profile.active ? "Desativar" : "Reativar"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Convites pendentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingInvites.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  Nenhum convite pendente no momento.
                </div>
              ) : (
                pendingInvites.map((invitation) => (
                  <div key={invitation.id} className="rounded-md border border-border bg-secondary/30 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="font-medium text-foreground">{invitation.email}</p>
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                          <span className="capitalize">{invitation.permission_level}</span>
                          <span>•</span>
                          <span>{new Date(invitation.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="gap-1"
                          onClick={() => resendInvite(invitation)}
                          disabled={busyInviteId === invitation.id}
                        >
                          <Send className="h-3.5 w-3.5" /> {busyInviteId === invitation.id ? "Enviando..." : "Reenviar"}
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => copyInviteLink(invitation)}>
                          <Copy className="h-3.5 w-3.5" /> Copiar link
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => revokeInvitation(invitation.id)}>Revogar</Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminManagers;