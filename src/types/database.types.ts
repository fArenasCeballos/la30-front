export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: "admin" | "caja" | "mesero" | "cocina";
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          role?: "admin" | "caja" | "mesero" | "cocina";
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          role?: "admin" | "caja" | "mesero" | "cocina";
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          sort_order: number;
          label: string;
          icon: string;
          id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          category_id: string | null;
          name: string;
          description: string | null;
          price: number;
          image_url: string | null;
          available: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          category_id?: string | null;
          name: string;
          description?: string | null;
          price: number;
          image_url?: string | null;
          available?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string | null;
          name?: string;
          description?: string | null;
          price?: number;
          image_url?: string | null;
          available?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      product_custom_options: {
        Row: {
          icon: string;
          label: string;
          option_key: string;
          sort_order: number;
          category_id: string;
          id: string;
          product_id: string | null;
          name: string;
          is_required: boolean;
          max_selections: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id?: string | null;
          name: string;
          is_required?: boolean;
          max_selections?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string | null;
          name?: string;
          is_required?: boolean;
          max_selections?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_custom_options_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_custom_choices: {
        Row: {
          icon: string;
          label: string;
          value: string;
          sort_order: number;
          id: string;
          option_id: string;
          name: string;
          price_adjustment: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          option_id?: string | null;
          name: string;
          price_adjustment?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          option_id?: string | null;
          name?: string;
          price_adjustment?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_custom_choices_option_id_fkey";
            columns: ["option_id"];
            referencedRelation: "product_custom_options";
            referencedColumns: ["id"];
          },
        ];
      };
      product_extras: {
        Row: {
          id: string;
          product_id: string | null;
          name: string;
          price: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id?: string | null;
          name: string;
          price: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string | null;
          name?: string;
          price?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_extras_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          user_id: string | null;
          status:
            | "pendiente"
            | "confirmado"
            | "en_preparacion"
            | "listo"
            | "entregado"
            | "cancelado";
          total_amount: number;
          notes: string | null;
          locator: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          status?:
            | "pendiente"
            | "confirmado"
            | "en_preparacion"
            | "listo"
            | "entregado"
            | "cancelado";
          total_amount: number;
          notes?: string | null;
          locator?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          status?:
            | "pendiente"
            | "confirmado"
            | "en_preparacion"
            | "listo"
            | "entregado"
            | "cancelado";
          total_amount?: number;
          notes?: string | null;
          locator?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string | null;
          product_id: string | null;
          quantity: number;
          unit_price: number;
          subtotal: number;
          notes: string | null;
          customizations: Json | null;
          extras: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id?: string | null;
          product_id?: string | null;
          quantity: number;
          unit_price: number;
          subtotal: number;
          notes?: string | null;
          customizations?: Json | null;
          extras?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string | null;
          product_id?: string | null;
          quantity?: number;
          unit_price?: number;
          subtotal?: number;
          notes?: string | null;
          customizations?: Json | null;
          extras?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          order_id: string | null;
          amount: number;
          method: "efectivo" | "tarjeta" | "nequi";
          status: string;
          transaction_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id?: string | null;
          amount: number;
          method: "efectivo" | "tarjeta" | "nequi";
          status: string;
          transaction_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string | null;
          amount?: number;
          method?: "efectivo" | "tarjeta" | "nequi";
          status?: string;
          transaction_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          read: unknown;
          id: string;
          user_id: string | null;
          title: string;
          message: string;
          type: "info" | "success" | "warning";
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title: string;
          message: string;
          type: "info" | "success" | "warning";
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          title?: string;
          message?: string;
          type?: "info" | "success" | "warning";
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_update_user_password: {
        Args: {
          p_user_id: string;
          p_new_password: string;
        };
        Returns: undefined;
      };
      get_my_profile: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          name: string;
          email: string;
          role: "admin" | "caja" | "mesero" | "cocina";
          avatar_url: string | null;
          is_active: boolean;
        }[];
      };
      cleanup_old_records: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      create_order: {
        Args: { p_locator: string; p_items: Json; p_notes: string | null };
        Returns: Json;
      };
      update_order: {
        Args: {
          p_order_id: string;
          p_locator: string;
          p_items: Json;
          p_notes: string | null;
        };
        Returns: Json;
      };
      update_order_status: {
        Args: { p_order_id: string; p_status: string };
        Returns: Json;
      };
      process_payment: {
        Args: {
          p_order_id: string;
          p_method: string;
          p_amount_received: number;
        };
        Returns: Json;
      };
      mark_notifications_read: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      clear_my_notifications: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      get_unread_count: {
        Args: Record<string, never>;
        Returns: number;
      };
      generate_cash_closing: {
        Args: {
          p_period_start: string;
          p_period_end: string;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      get_all_users: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          name: string;
          email: string;
          role: "admin" | "caja" | "mesero" | "cocina";
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
        }[];
      };
      update_user: {
        Args: {
          p_user_id: string;
          p_name?: string | null;
          p_email?: string | null;
          p_role?: string | null;
          p_is_active?: boolean | null;
        };
        Returns: Json;
      };
      toggle_product_availability: {
        Args: { p_product_id: string };
        Returns: Json;
      };
      get_dashboard_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_top_products: {
        Args: { p_limit: number | null };
        Returns: {
          product_name: string;
          category: string;
          quantity: number;
          revenue: number;
        }[];
      };
      auth_user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: {
      user_role: "admin" | "caja" | "mesero" | "cocina";
      order_status:
        | "pendiente"
        | "confirmado"
        | "en_preparacion"
        | "listo"
        | "entregado"
        | "cancelado";
      payment_method: "efectivo" | "tarjeta" | "nequi";
      notification_type: "info" | "success" | "warning";
    };
  };
};

// ---- Convenience type aliases ----
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertDto<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateDto<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
