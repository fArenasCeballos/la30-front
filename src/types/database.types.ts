export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          role: 'admin' | 'caja' | 'mesero' | 'cocina'
          avatar_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          role?: 'admin' | 'caja' | 'mesero' | 'cocina'
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          role?: 'admin' | 'caja' | 'mesero' | 'cocina'
          avatar_url?: string | null
          is_active?: boolean
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          label: string
          icon: string | null
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          label: string
          icon?: string | null
          sort_order?: number
          is_active?: boolean
        }
        Update: {
          name?: string
          label?: string
          icon?: string | null
          sort_order?: number
          is_active?: boolean
        }
      }
      products: {
        Row: {
          id: string
          name: string
          category_id: string
          price: number
          image_url: string | null
          available: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category_id: string
          price: number
          image_url?: string | null
          available?: boolean
          sort_order?: number
        }
        Update: {
          name?: string
          category_id?: string
          price?: number
          image_url?: string | null
          available?: boolean
          sort_order?: number
        }
      }
      product_custom_options: {
        Row: {
          id: string
          category_id: string
          option_key: string
          label: string
          icon: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          category_id: string
          option_key: string
          label: string
          icon?: string | null
          sort_order?: number
        }
        Update: {
          category_id?: string
          option_key?: string
          label?: string
          icon?: string | null
          sort_order?: number
        }
      }
      product_custom_choices: {
        Row: {
          id: string
          option_id: string
          value: string
          label: string
          icon: string | null
          sort_order: number
        }
        Insert: {
          id?: string
          option_id: string
          value: string
          label: string
          icon?: string | null
          sort_order?: number
        }
        Update: {
          option_id?: string
          value?: string
          label?: string
          icon?: string | null
          sort_order?: number
        }
      }
      product_extras: {
        Row: {
          id: string
          category_id: string
          extra_key: string
          label: string
          icon: string | null
          price_per_unit: number
          max_qty: number
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          category_id: string
          extra_key: string
          label: string
          icon?: string | null
          price_per_unit: number
          max_qty?: number
          sort_order?: number
        }
        Update: {
          category_id?: string
          extra_key?: string
          label?: string
          icon?: string | null
          price_per_unit?: number
          max_qty?: number
          sort_order?: number
        }
      }
      orders: {
        Row: {
          id: string
          locator: string
          ticket_number: number
          status: 'pendiente' | 'confirmado' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado'
          total: number
          notes: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          locator: string
          ticket_number?: number
          status?: 'pendiente' | 'confirmado' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado'
          total?: number
          notes?: string | null
          created_by: string
        }
        Update: {
          locator?: string
          ticket_number?: number
          status?: 'pendiente' | 'confirmado' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado'
          total?: number
          notes?: string | null
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          notes?: string | null
        }
        Update: {
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          notes?: string | null
        }
      }
      payments: {
        Row: {
          id: string
          order_id: string
          method: 'efectivo' | 'tarjeta' | 'nequi'
          amount_total: number
          amount_received: number
          amount_change: number
          processed_by: string
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          method: 'efectivo' | 'tarjeta' | 'nequi'
          amount_total: number
          amount_received: number
          amount_change?: number
          processed_by: string
        }
        Update: {
          method?: 'efectivo' | 'tarjeta' | 'nequi'
          amount_total?: number
          amount_received?: number
          amount_change?: number
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          message: string
          type: 'info' | 'success' | 'warning'
          order_id: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          message: string
          type?: 'info' | 'success' | 'warning'
          order_id?: string | null
          read?: boolean
        }
        Update: {
          message?: string
          type?: 'info' | 'success' | 'warning'
          read?: boolean
        }
      }
      order_status_log: {
        Row: {
          id: string
          order_id: string
          previous_status: 'pendiente' | 'confirmado' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado' | null
          new_status: 'pendiente' | 'confirmado' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado'
          changed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          previous_status?: 'pendiente' | 'confirmado' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado' | null
          new_status: 'pendiente' | 'confirmado' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado'
          changed_by?: string | null
        }
        Update: Record<string, never>
      }
      cash_register_closings: {
        Row: {
          id: string
          closed_by: string
          period_start: string
          period_end: string
          total_sales: number
          total_orders: number
          delivered_count: number
          pending_count: number
          pending_total: number
          cancelled_count: number
          cancelled_total: number
          cash_total: number
          card_total: number
          nequi_total: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          closed_by: string
          period_start: string
          period_end: string
          total_sales?: number
          total_orders?: number
          delivered_count?: number
          pending_count?: number
          pending_total?: number
          cancelled_count?: number
          cancelled_total?: number
          cash_total?: number
          card_total?: number
          nequi_total?: number
          notes?: string | null
        }
        Update: Record<string, never>
      }
    }
    Views: {
      v_daily_sales: {
        Row: {
          sale_date: string
          total_orders: number
          delivered_orders: number
          cancelled_orders: number
          total_revenue: number
          avg_ticket: number
        }
      }
      v_hourly_sales: {
        Row: {
          sale_date: string
          hour: number
          order_count: number
          total_revenue: number
        }
      }
      v_top_products: {
        Row: {
          id: string
          name: string
          category: string
          total_quantity: number
          total_revenue: number
        }
      }
      v_waiter_performance: {
        Row: {
          user_id: string
          waiter_name: string
          total_orders: number
          total_revenue: number
          delivered_revenue: number
          cancelled_orders: number
        }
      }
    }
    Functions: {
      get_my_profile: {
        Args: Record<string, never>
        Returns: {
          id: string
          name: string
          email: string
          role: 'admin' | 'caja' | 'mesero' | 'cocina'
          avatar_url: string | null
          is_active: boolean
        }[]
      }
      create_order: {
        Args: { p_locator: string; p_items: Json; p_notes?: string | null }
        Returns: Json
      }
      update_order_status: {
        Args: { p_order_id: string; p_status: string }
        Returns: Json
      }
      process_payment: {
        Args: { p_order_id: string; p_method: string; p_amount_received: number }
        Returns: Json
      }
      mark_notifications_read: {
        Args: Record<string, never>
        Returns: undefined
      }
      clear_my_notifications: {
        Args: Record<string, never>
        Returns: undefined
      }
      get_unread_count: {
        Args: Record<string, never>
        Returns: number
      }
      generate_cash_closing: {
        Args: { p_period_start: string; p_period_end: string; p_notes?: string | null }
        Returns: Json
      }
      get_all_users: {
        Args: Record<string, never>
        Returns: {
          id: string
          name: string
          email: string
          role: 'admin' | 'caja' | 'mesero' | 'cocina'
          avatar_url: string | null
          is_active: boolean
          created_at: string
        }[]
      }
      update_user: {
        Args: { p_user_id: string; p_name?: string | null; p_email?: string | null; p_role?: string | null; p_is_active?: boolean | null }
        Returns: Json
      }
      toggle_product_availability: {
        Args: { p_product_id: string }
        Returns: Json
      }
      get_dashboard_stats: {
        Args: Record<string, never>
        Returns: Json
      }
      get_top_products: {
        Args: { p_limit?: number }
        Returns: { product_name: string; category: string; quantity: number; revenue: number }[]
      }
      auth_user_role: {
        Args: Record<string, never>
        Returns: string
      }
    }
    Enums: {
      user_role: 'admin' | 'caja' | 'mesero' | 'cocina'
      order_status: 'pendiente' | 'confirmado' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado'
      payment_method: 'efectivo' | 'tarjeta' | 'nequi'
      notification_type: 'info' | 'success' | 'warning'
    }
  }
}

// ---- Convenience type aliases ----
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertDto<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateDto<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
