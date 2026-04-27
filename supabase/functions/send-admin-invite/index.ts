import { createClient } from "npm:@supabase/supabase-js@2";
import { sendLovableEmail } from "npm:@lovable.dev/email-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SENDER_DOMAIN = "notify.horensuplementos.com.br";
const SITE_NAME = "Horen Suplementos";
const SITE_URL = "https://horensuplementos.com.br";

const emailFailureMessage = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (raw.includes("403") || raw.toLowerCase().includes("disabled") || raw.toLowerCase().includes("domain")) {
    return "O envio de e-mail ainda não está ativo para este domínio. Verifique o DNS em Cloud → Emails e use o link manual enquanto isso.";
  }
  return "Não foi possível enviar o e-mail agora. Use o link manual e tente reenviar depois.";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    // Validate caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from("admin_profiles")
      .select("permission_level, active")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    let isAdmin = profile?.active && profile?.permission_level === "admin";
    if (!isAdmin) {
      const { data: hasRole } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
      isAdmin = !!hasRole;
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Sem permissão." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { invitation_id } = await req.json();
    if (!invitation_id) {
      return new Response(JSON.stringify({ error: "invitation_id obrigatório." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: invitation, error: invErr } = await admin
      .from("admin_invitations")
      .select("id, email, permission_level, invite_token, accepted_at, revoked_at")
      .eq("id", invitation_id)
      .maybeSingle();

    if (invErr || !invitation) {
      return new Response(JSON.stringify({ error: "Convite não encontrado." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (invitation.revoked_at) {
      return new Response(JSON.stringify({ error: "Convite revogado." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (invitation.accepted_at) {
      return new Response(JSON.stringify({ error: "Convite já aceito." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const acceptUrl = `${SITE_URL}/aceitar-convite?token=${invitation.invite_token}`;
    const levelLabel: Record<string, string> = {
      admin: "Administrador",
      operator: "Operador",
      editor: "Editor",
    };

    const subject = `Convite para administrar ${SITE_NAME}`;
    const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:40px 32px;">
        <tr><td align="center" style="padding-bottom:24px;">
          <div style="font-size:22px;font-weight:bold;color:#002A3F;letter-spacing:0.5px;">${SITE_NAME}</div>
        </td></tr>
        <tr><td>
          <h1 style="margin:0 0 16px;font-size:22px;color:#002A3F;font-weight:bold;">Você foi convidado(a) como ${levelLabel[invitation.permission_level] || invitation.permission_level}</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
            Olá! Você recebeu um convite para acessar o painel administrativo da <strong>${SITE_NAME}</strong> com o nível de acesso <strong>${levelLabel[invitation.permission_level] || invitation.permission_level}</strong>.
          </p>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#374151;">
            Para aceitar este convite, clique no botão abaixo. Você precisará criar uma conta ou fazer login utilizando o e-mail <strong>${invitation.email}</strong>.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
            <tr><td align="center" style="background:#002A3F;border-radius:6px;">
              <a href="${acceptUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">Aceitar convite</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Se o botão não funcionar, copie e cole este link no navegador:</p>
          <p style="margin:0 0 24px;font-size:12px;color:#002A3F;word-break:break-all;">${acceptUrl}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Se você não esperava este convite, pode ignorar este e-mail com segurança.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const text = `Você foi convidado(a) para administrar ${SITE_NAME} como ${levelLabel[invitation.permission_level] || invitation.permission_level}.\n\nAceite o convite acessando: ${acceptUrl}\n\nUse o e-mail ${invitation.email} para fazer login ou criar sua conta.`;

    const messageId = crypto.randomUUID();

    try {
      await sendLovableEmail(
        {
          message_id: messageId,
          to: invitation.email,
          from: `${SITE_NAME} <convites@${SENDER_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject,
          html,
          text,
          purpose: "transactional",
          label: "admin_invite",
          idempotency_key: `admin-invite-${invitation.id}-${Date.now()}`,
        },
        { apiKey: Deno.env.get("LOVABLE_API_KEY")!, sendUrl: Deno.env.get("LOVABLE_SEND_URL") }
      );

      await admin.from("email_send_log").insert({
        message_id: messageId,
        template_name: "admin_invite",
        recipient_email: invitation.email,
        status: "sent",
        metadata: { invitation_id: invitation.id, permission_level: invitation.permission_level },
      });

      return new Response(JSON.stringify({ success: true, accept_url: acceptUrl }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (emailErr) {
      const rawError = emailErr instanceof Error ? emailErr.message : String(emailErr || "Erro desconhecido");
      console.error("sendLovableEmail admin invite error:", rawError);

      await admin.from("email_send_log").insert({
        message_id: messageId,
        template_name: "admin_invite",
        recipient_email: invitation.email,
        status: "failed",
        error_message: rawError.slice(0, 1000),
        metadata: { invitation_id: invitation.id, permission_level: invitation.permission_level },
      });

      return new Response(JSON.stringify({ success: false, error: emailFailureMessage(emailErr), accept_url: acceptUrl }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err) {
    console.error("send-admin-invite error:", err);
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
