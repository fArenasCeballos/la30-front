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
      delivery_drivers: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          phone: string;
          motorcycle_plate: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          first_name: string;
          last_name: string;
          phone: string;
          motorcycle_plate: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string;
          last_name?: string;
          phone?: string;
          motorcycle_plate?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      delivery_zones: {
        Row: {
          id: string;
          name: string;
          price: number;
          polygon: Json;
          color: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          price: number;
          polygon?: Json;
          color?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          price?: number;
          polygon?: Json;
          color?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      raw_material_categories: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          color?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          name?: string;
          color?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "raw_material_categories_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          }
        ];
      };
      suppliers: {
        Row: {
          id: string;
          store_id: string;
          nit: string;
          name: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          nit: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          nit?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "suppliers_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          }
        ];
      };
      stores: {
        Row: {
          id: string;
          name: string;
          slug: string;
          icon: string | null;
          color: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          icon?: string | null;
          color?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          icon?: string | null;
          color?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: "admin" | "caja" | "mesero" | "cocina" | "bodega";
          avatar_url: string | null;
          is_active: boolean;
          store_id: string | null;
          allowed_store_ids: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          role?: "admin" | "caja" | "mesero" | "cocina" | "bodega";
          avatar_url?: string | null;
          is_active?: boolean;
          store_id?: string | null;
          allowed_store_ids?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          role?: "admin" | "caja" | "mesero" | "cocina" | "bodega";
          avatar_url?: string | null;
          is_active?: boolean;
          store_id?: string | null;
          allowed_store_ids?: string[] | null;
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
          store_ids: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          label: string;
          icon?: string | null;
          sort_order?: number;
          description?: string | null;
          is_active?: boolean;
          store_ids?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          label?: string;
          icon?: string | null;
          sort_order?: number;
          description?: string | null;
          is_active?: boolean;
          store_ids?: string[];
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
          sort_order: number;
          store_ids: string[];
          created_at: string;
          siigo_code: string | null;
        };
        Insert: {
          id?: string;
          category_id?: string | null;
          name: string;
          description?: string | null;
          price: number;
          image_url?: string | null;
          available?: boolean;
          sort_order?: number;
          store_ids?: string[];
          created_at?: string;
          siigo_code?: string | null;
        };
        Update: {
          id?: string;
          category_id?: string | null;
          name?: string;
          description?: string | null;
          price?: number;
          image_url?: string | null;
          available?: boolean;
          sort_order?: number;
          store_ids?: string[];
          created_at?: string;
          siigo_code?: string | null;
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
          id: string;
          category_id: string;
          category_ids: string[] | null;
          option_key: string;
          label: string;
          icon: string | null;
          sort_order: number;
          store_ids: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          category_id?: string | null;
          category_ids?: string[] | null;
          option_key: string;
          label: string;
          icon?: string | null;
          sort_order?: number;
          store_ids?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string | null;
          category_ids?: string[] | null;
          option_key?: string;
          label?: string;
          icon?: string | null;
          sort_order?: number;
          store_ids?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      product_custom_choices: {
        Row: {
          icon: string;
          label: string;
          value: string;
          sort_order: number;
          id: string;
          option_id: string;
          price_adjustment: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          option_id: string;
          label: string;
          value: string;
          icon?: string | null;
          sort_order?: number;
          price_adjustment?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          option_id?: string;
          label?: string;
          value?: string;
          icon?: string | null;
          sort_order?: number;
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
          category_id: string;
          category_ids: string[] | null;
          extra_key: string;
          label: string;
          icon: string | null;
          price_per_unit: number;
          max_qty: number;
          sort_order: number | null;
          store_ids: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          category_id?: string | null;
          category_ids?: string[] | null;
          extra_key: string;
          label: string;
          icon?: string | null;
          price_per_unit: number;
          max_qty?: number;
          sort_order?: number | null;
          store_ids?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string | null;
          category_ids?: string[] | null;
          extra_key?: string;
          label?: string;
          icon?: string | null;
          price_per_unit?: number;
          max_qty?: number;
          sort_order?: number | null;
          store_ids?: string[];
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
          total: number;
          id: string;
          user_id: string | null;
          store_id: string;
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
          delivery_name: string | null;
          delivery_address: string | null;
          delivery_phone: string | null;
          delivery_fee: number;
          is_delivery: boolean;
          is_dispatched: boolean;
          driver_id: string | null;
          created_at: string;
          updated_at: string;
          siigo_invoice_id: string | null;
          siigo_invoice_number: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          store_id: string;
          status?:
            | "pendiente"
            | "confirmado"
            | "en_preparacion"
            | "listo"
            | "entregado"
            | "cancelado";
          total?: number;
          total_amount: number;
          notes?: string | null;
          locator?: string | null;
          delivery_name?: string | null;
          delivery_address?: string | null;
          delivery_phone?: string | null;
          delivery_fee?: number;
          is_delivery?: boolean;
          is_dispatched?: boolean;
          driver_id?: string | null;
          created_at?: string;
          updated_at?: string;
          siigo_invoice_id?: string | null;
          siigo_invoice_number?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          store_id?: string;
          status?:
            | "pendiente"
            | "confirmado"
            | "en_preparacion"
            | "listo"
            | "entregado"
            | "cancelado";
          total?: number;
          total_amount?: number;
          notes?: string | null;
          locator?: string | null;
          delivery_name?: string | null;
          delivery_address?: string | null;
          delivery_phone?: string | null;
          delivery_fee?: number;
          is_delivery?: boolean;
          is_dispatched?: boolean;
          driver_id?: string | null;
          created_at?: string;
          updated_at?: string;
          siigo_invoice_id?: string | null;
          siigo_invoice_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_driver_id_fkey";
            columns: ["driver_id"];
            referencedRelation: "delivery_drivers";
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
          is_completed: boolean;
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
          is_completed?: boolean;
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
          is_completed?: boolean;
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
          order_id: string;
          method: "efectivo" | "tarjeta" | "nequi" | "mixto";
          amount_total: number;
          amount_received: number;
          amount_change: number;
          amount_efectivo: number;
          amount_tarjeta: number;
          amount_nequi: number;
          processed_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          method: "efectivo" | "tarjeta" | "nequi" | "mixto";
          amount_total: number;
          amount_received: number;
          amount_change?: number;
          amount_efectivo?: number;
          amount_tarjeta?: number;
          amount_nequi?: number;
          processed_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          method?: "efectivo" | "tarjeta" | "nequi" | "mixto";
          amount_total?: number;
          amount_received?: number;
          amount_change?: number;
          amount_efectivo?: number;
          amount_tarjeta?: number;
          amount_nequi?: number;
          processed_by?: string;
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
      raw_materials: {
        Row: {
          id: string;
          store_id: string;
          category_id: string | null;
          name: string;
          unit: string;
          min_stock: number;
          current_stock: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          category_id?: string | null;
          name: string;
          unit: string;
          min_stock?: number;
          current_stock?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          category_id?: string | null;
          name?: string;
          unit?: string;
          min_stock?: number;
          current_stock?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "raw_materials_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "raw_materials_category_id_fkey";
            columns: ["category_id"];
            referencedRelation: "raw_material_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      raw_material_entries: {
        Row: {
          id: string;
          raw_material_id: string;
          quantity: number;
          unit_cost: number;
          total_cost: number;
          entry_date: string;
          supplier_name: string | null;
          supplier_id: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          raw_material_id: string;
          quantity: number;
          unit_cost: number;
          entry_date?: string;
          supplier_name?: string | null;
          supplier_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          raw_material_id?: string;
          quantity?: number;
          unit_cost?: number;
          entry_date?: string;
          supplier_name?: string | null;
          supplier_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "raw_material_entries_raw_material_id_fkey";
            columns: ["raw_material_id"];
            referencedRelation: "raw_materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "raw_material_entries_supplier_id_fkey";
            columns: ["supplier_id"];
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "raw_material_entries_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      recipes: {
        Row: {
          id: string;
          product_id: string;
          raw_material_id: string;
          quantity_required: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          raw_material_id: string;
          quantity_required: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          raw_material_id?: string;
          quantity_required?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipes_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipes_raw_material_id_fkey";
            columns: ["raw_material_id"];
            referencedRelation: "raw_materials";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_movements: {
        Row: {
          id: string;
          raw_material_id: string;
          order_id: string | null;
          entry_id: string | null;
          quantity: number;
          movement_type: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          raw_material_id: string;
          order_id?: string | null;
          entry_id?: string | null;
          quantity: number;
          movement_type: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          raw_material_id?: string;
          order_id?: string | null;
          entry_id?: string | null;
          quantity?: number;
          movement_type?: string;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_raw_material_id_fkey";
            columns: ["raw_material_id"];
            referencedRelation: "raw_materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey";
            columns: ["order_id"];
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_entry_id_fkey";
            columns: ["entry_id"];
            referencedRelation: "raw_material_entries";
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
          role: "admin" | "caja" | "mesero" | "cocina" | "bodega";
          avatar_url: string | null;
          is_active: boolean;
        }[];
      };
      has_other_sessions: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      cleanup_old_records: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      create_order: {
        Args: {
          p_locator: string;
          p_items: Json;
          p_notes: string | null;
          p_store_id?: string | null;
        };
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
      toggle_order_item_completed: {
        Args: { p_item_id: string; p_completed: boolean };
        Returns: undefined;
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
          p_store_id?: string | null;
        };
        Returns: Json;
      };
      get_all_users: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          name: string;
          email: string;
          role: "admin" | "caja" | "mesero" | "cocina" | "bodega";
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
          p_store_id?: string | null;
        };
        Returns: Json;
      };
      toggle_product_availability: {
        Args: { p_product_id: string };
        Returns: Json;
      };
      get_dashboard_stats: {
        Args: { p_store_id?: string | null };
        Returns: Json;
      };
      get_reporteria_stats: {
        Args: {
          p_start: string;
          p_end: string;
          p_store_id?: string | null;
          p_type_filter?: string | null;
        };
        Returns: Json;
      };
      get_customization_for_category: {
        Args: {
          p_category_name: string;
        };
        Returns: {
          options: {
            id: string;
            option_key: string;
            label: string;
            icon: string;
            choices: {
              id: string;
              value: string;
              label: string;
              icon: string;
            }[];
          }[];
          extras: {
            id: string;
            extra_key: string;
            label: string;
            icon: string;
            price_per_unit: number;
            max_qty: number;
          }[];
        };
      };
      get_top_products: {
        Args: { p_limit: number | null; p_store_id?: string | null };
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
      deduct_stock_from_order: {
        Args: {
          p_order_id: string;
        };
        Returns: {
          status: string;
          order_id?: string;
          items_in_order?: number;
          items_with_recipe?: number;
          items_without_recipe?: number;
          materials_deducted?: number;
          low_stock_alerts?: string[];
          message?: string;
        };
      };
      update_user_allowed_stores: {
        Args: {
          p_user_id: string;
          p_store_ids: string[] | null;
        };
        Returns: void;
      };
    };
    Enums: {
      user_role: "admin" | "caja" | "mesero" | "cocina" | "bodega";
      order_status:
        | "pendiente"
        | "confirmado"
        | "en_preparacion"
        | "listo"
        | "entregado"
        | "cancelado";
      payment_method: "efectivo" | "tarjeta" | "nequi" | "mixto";
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
