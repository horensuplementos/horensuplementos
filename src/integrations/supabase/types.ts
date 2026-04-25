export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          permission_level: Database["public"]["Enums"]["admin_permission_level"]
          revoked_at: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          permission_level?: Database["public"]["Enums"]["admin_permission_level"]
          revoked_at?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          permission_level?: Database["public"]["Enums"]["admin_permission_level"]
          revoked_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          invited_by: string | null
          permission_level: Database["public"]["Enums"]["admin_permission_level"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          permission_level?: Database["public"]["Enums"]["admin_permission_level"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          permission_level?: Database["public"]["Enums"]["admin_permission_level"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cart_sessions: {
        Row: {
          abandoned_at: string | null
          cart_total: number
          converted_order_id: string | null
          created_at: string
          email: string | null
          first_product_added_at: string | null
          id: string
          items: Json
          items_count: number
          last_activity_at: string
          metadata: Json
          recovered_at: string | null
          recovery_sent_at: string | null
          session_id: string
          status: Database["public"]["Enums"]["cart_session_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          abandoned_at?: string | null
          cart_total?: number
          converted_order_id?: string | null
          created_at?: string
          email?: string | null
          first_product_added_at?: string | null
          id?: string
          items?: Json
          items_count?: number
          last_activity_at?: string
          metadata?: Json
          recovered_at?: string | null
          recovery_sent_at?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["cart_session_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          abandoned_at?: string | null
          cart_total?: number
          converted_order_id?: string | null
          created_at?: string
          email?: string | null
          first_product_added_at?: string | null
          id?: string
          items?: Json
          items_count?: number
          last_activity_at?: string
          metadata?: Json
          recovered_at?: string | null
          recovery_sent_at?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["cart_session_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value: number
          expires_at: string | null
          id: string
          minimum_order_amount: number
          starts_at: string | null
          updated_at: string
          usage_limit: number | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value: number
          expires_at?: string | null
          id?: string
          minimum_order_amount?: number
          starts_at?: string | null
          updated_at?: string
          usage_limit?: number | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value?: number
          expires_at?: string | null
          id?: string
          minimum_order_amount?: number
          starts_at?: string | null
          updated_at?: string
          usage_limit?: number | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          automation_log: Json | null
          bling_order_id: string | null
          cart_session_id: string | null
          coupon_code: string | null
          coupon_id: string | null
          created_at: string
          customer_address: string | null
          customer_cpf: string | null
          customer_email: string
          customer_name: string
          customer_phone: string | null
          discount_amount: number
          id: string
          invoice_key: string | null
          invoice_number: string | null
          payment_id: string | null
          payment_method: string | null
          shipping_order_id: string | null
          shipping_price: number | null
          shipping_service_id: number | null
          shipping_service_name: string | null
          shipping_status: string | null
          status: string
          subtotal_amount: number
          total: number
          tracking_code: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          automation_log?: Json | null
          bling_order_id?: string | null
          cart_session_id?: string | null
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_cpf?: string | null
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          discount_amount?: number
          id?: string
          invoice_key?: string | null
          invoice_number?: string | null
          payment_id?: string | null
          payment_method?: string | null
          shipping_order_id?: string | null
          shipping_price?: number | null
          shipping_service_id?: number | null
          shipping_service_name?: string | null
          shipping_status?: string | null
          status?: string
          subtotal_amount?: number
          total: number
          tracking_code?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          automation_log?: Json | null
          bling_order_id?: string | null
          cart_session_id?: string | null
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_cpf?: string | null
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          discount_amount?: number
          id?: string
          invoice_key?: string | null
          invoice_number?: string | null
          payment_id?: string | null
          payment_method?: string | null
          shipping_order_id?: string | null
          shipping_price?: number | null
          shipping_service_id?: number | null
          shipping_service_name?: string | null
          shipping_status?: string | null
          status?: string
          subtotal_amount?: number
          total?: number
          tracking_code?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_cart_session_id_fkey"
            columns: ["cart_session_id"]
            isOneToOne: false
            referencedRelation: "cart_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupon_usage_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          stock: number
          updated_at: string
          weight: string | null
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          stock?: number
          updated_at?: string
          weight?: string | null
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          stock?: number
          updated_at?: string
          weight?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          city: string | null
          cpf: string | null
          created_at: string
          id: string
          name: string | null
          neighborhood: string | null
          number: string | null
          phone: string | null
          state: string | null
          street: string | null
          updated_at: string
          user_id: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          id?: string
          name?: string | null
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          id?: string
          name?: string | null
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      site_content_sections: {
        Row: {
          active: boolean
          created_at: string
          cta_label: string | null
          cta_link: string | null
          description: string | null
          id: string
          image_url: string | null
          items: Json
          section_key: string
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cta_label?: string | null
          cta_link?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          items?: Json
          section_key: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cta_label?: string | null
          cta_link?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          items?: Json
          section_key?: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      cart_metrics_summary: {
        Row: {
          abandoned_carts: number | null
          abandoned_value: number | null
          carts_with_items: number | null
          converted_carts: number | null
          converted_value: number | null
          recovered_carts: number | null
        }
        Relationships: []
      }
      coupon_usage_summary: {
        Row: {
          active: boolean | null
          code: string | null
          description: string | null
          discount_type:
            | Database["public"]["Enums"]["coupon_discount_type"]
            | null
          discount_value: number | null
          expires_at: string | null
          id: string | null
          last_used_at: string | null
          minimum_order_amount: number | null
          starts_at: string | null
          total_discount_generated: number | null
          total_uses: number | null
          usage_limit: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_admin_invitation: {
        Args: { p_email: string; p_user_id: string }
        Returns: Json
      }
      calculate_coupon_discount: {
        Args: {
          p_discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          p_discount_value: number
          p_subtotal: number
        }
        Returns: number
      }
      has_admin_permission_level: {
        Args: {
          _levels: Database["public"]["Enums"]["admin_permission_level"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_stale_carts_abandoned: {
        Args: { p_minutes?: number }
        Returns: number
      }
      normalize_coupon_code: { Args: { p_code: string }; Returns: string }
      upsert_cart_session: {
        Args: {
          p_cart_total: number
          p_email: string
          p_items: Json
          p_items_count: number
          p_metadata?: Json
          p_session_id: string
          p_status: Database["public"]["Enums"]["cart_session_status"]
          p_user_id: string
        }
        Returns: string
      }
      validate_coupon: {
        Args: { p_code: string; p_subtotal: number }
        Returns: Json
      }
    }
    Enums: {
      admin_permission_level: "admin" | "operator" | "editor"
      app_role: "admin" | "user"
      cart_session_status: "active" | "abandoned" | "converted" | "recovered"
      coupon_discount_type: "fixed" | "percentage" | "free_shipping"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_permission_level: ["admin", "operator", "editor"],
      app_role: ["admin", "user"],
      cart_session_status: ["active", "abandoned", "converted", "recovered"],
      coupon_discount_type: ["fixed", "percentage", "free_shipping"],
    },
  },
} as const
