-- Add invite_token column for unique secure invitation links
ALTER TABLE public.admin_invitations
  ADD COLUMN IF NOT EXISTS invite_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS admin_invitations_invite_token_unique
  ON public.admin_invitations(invite_token);

-- Function to accept invitation by token (used on /aceitar-convite page)
CREATE OR REPLACE FUNCTION public.accept_admin_invitation_by_token(p_user_id UUID, p_token UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation public.admin_invitations%ROWTYPE;
  v_user_email TEXT;
BEGIN
  IF p_user_id IS NULL OR p_token IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'message', 'Dados inválidos.');
  END IF;

  SELECT * INTO v_invitation
  FROM public.admin_invitations
  WHERE invite_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('accepted', false, 'message', 'Convite não encontrado.');
  END IF;

  IF v_invitation.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('accepted', false, 'message', 'Este convite foi revogado.');
  END IF;

  IF v_invitation.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('accepted', true, 'message', 'Convite já aceito.', 'permission_level', v_invitation.permission_level);
  END IF;

  SELECT lower(email) INTO v_user_email FROM auth.users WHERE id = p_user_id;

  IF v_user_email IS NULL OR v_user_email <> lower(v_invitation.email) THEN
    RETURN jsonb_build_object('accepted', false, 'message', 'Faça login com o e-mail ' || v_invitation.email || ' para aceitar este convite.');
  END IF;

  INSERT INTO public.admin_profiles (user_id, email, permission_level, invited_by, active)
  VALUES (p_user_id, v_user_email, v_invitation.permission_level, v_invitation.invited_by, true)
  ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email,
      permission_level = EXCLUDED.permission_level,
      invited_by = EXCLUDED.invited_by,
      active = true,
      updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.admin_invitations
  SET accepted_at = now(),
      accepted_by = p_user_id,
      updated_at = now()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object('accepted', true, 'permission_level', v_invitation.permission_level);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_admin_invitation_by_token(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_admin_invitation_by_token(UUID, UUID) TO anon;