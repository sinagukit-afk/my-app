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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_number: string
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_postable: boolean
          name: string
          parent_account_id: string | null
          updated_at: string
        }
        Insert: {
          account_number: string
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_postable?: boolean
          name: string
          parent_account_id?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_postable?: boolean
          name?: string
          parent_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_categories: {
        Row: {
          created_at: string
          default_accum_depreciation_account_id: string | null
          default_asset_account_id: string | null
          default_depreciation_expense_account_id: string | null
          default_useful_life_months: number | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_accum_depreciation_account_id?: string | null
          default_asset_account_id?: string | null
          default_depreciation_expense_account_id?: string | null
          default_useful_life_months?: number | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_accum_depreciation_account_id?: string | null
          default_asset_account_id?: string | null
          default_depreciation_expense_account_id?: string | null
          default_useful_life_months?: number | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_categories_default_accum_depreciation_account_id_fkey"
            columns: ["default_accum_depreciation_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_categories_default_asset_account_id_fkey"
            columns: ["default_asset_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_categories_default_depreciation_expense_account_id_fkey"
            columns: ["default_depreciation_expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number_masked: string | null
          bank: string
          created_at: string
          currency: string
          gl_account_id: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_number_masked?: string | null
          bank: string
          created_at?: string
          currency?: string
          gl_account_id: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_number_masked?: string | null
          bank?: string
          created_at?: string
          currency?: string
          gl_account_id?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      business_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          occurred_at: string
          payload: Json
          processed_at: string | null
          source_id: string
          source_table: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          occurred_at?: string
          payload: Json
          processed_at?: string | null
          source_id: string
          source_table: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          occurred_at?: string
          payload?: Json
          processed_at?: string | null
          source_id?: string
          source_table?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          category_type: string
          color: string | null
          created_at: string
          default_expense_account_id: string | null
          default_inventory_account_id: string | null
          default_revenue_account_id: string | null
          deleted_at: string | null
          id: string
          loyverse_category_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          category_type?: string
          color?: string | null
          created_at?: string
          default_expense_account_id?: string | null
          default_inventory_account_id?: string | null
          default_revenue_account_id?: string | null
          deleted_at?: string | null
          id?: string
          loyverse_category_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          category_type?: string
          color?: string | null
          created_at?: string
          default_expense_account_id?: string | null
          default_inventory_account_id?: string | null
          default_revenue_account_id?: string | null
          deleted_at?: string | null
          id?: string
          loyverse_category_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_default_expense_account_id_fkey"
            columns: ["default_expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_default_inventory_account_id_fkey"
            columns: ["default_inventory_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_default_revenue_account_id_fkey"
            columns: ["default_revenue_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      couriers: {
        Row: {
          contact_number: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          contact_number?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          contact_number?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_card_installment_payments: {
        Row: {
          created_at: string
          id: string
          interest_amount: number
          notes: string | null
          paid_by: string | null
          paid_date: string
          payment_type_id: string
          principal_amount: number
        }
        Insert: {
          created_at?: string
          id?: string
          interest_amount?: number
          notes?: string | null
          paid_by?: string | null
          paid_date?: string
          payment_type_id: string
          principal_amount: number
        }
        Update: {
          created_at?: string
          id?: string
          interest_amount?: number
          notes?: string | null
          paid_by?: string | null
          paid_date?: string
          payment_type_id?: string
          principal_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_installment_payments_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_installment_payments_payment_type_id_fkey"
            columns: ["payment_type_id"]
            isOneToOne: false
            referencedRelation: "payment_types"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_sources: {
        Row: {
          created_at: string
          customer_id: string
          external_id: string | null
          external_username: string | null
          id: string
          linked_at: string
          profile_url: string | null
          raw: Json | null
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          external_id?: string | null
          external_username?: string | null
          id?: string
          linked_at?: string
          profile_url?: string | null
          raw?: Json | null
          source: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          external_id?: string | null
          external_username?: string | null
          id?: string
          linked_at?: string
          profile_url?: string | null
          raw?: Json | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_sources_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_sources_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_sales_summary"
            referencedColumns: ["customer_id"]
          },
        ]
      }
      customers: {
        Row: {
          address_line1: string | null
          barangay: string | null
          city: string | null
          created_at: string
          customer_code: string | null
          deleted_at: string | null
          email: string | null
          id: string
          loyverse_customer_id: string | null
          name: string | null
          note: string | null
          phone_number: string | null
          postal_code: string | null
          province: string | null
          total_points: number
          total_spent: number
          total_visits: number
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          barangay?: string | null
          city?: string | null
          created_at?: string
          customer_code?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          loyverse_customer_id?: string | null
          name?: string | null
          note?: string | null
          phone_number?: string | null
          postal_code?: string | null
          province?: string | null
          total_points?: number
          total_spent?: number
          total_visits?: number
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          barangay?: string | null
          city?: string | null
          created_at?: string
          customer_code?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          loyverse_customer_id?: string | null
          name?: string | null
          note?: string | null
          phone_number?: string | null
          postal_code?: string | null
          province?: string | null
          total_points?: number
          total_spent?: number
          total_visits?: number
          updated_at?: string
        }
        Relationships: []
      }
      depreciation_entries: {
        Row: {
          amount: number
          created_at: string
          fixed_asset_id: string
          id: string
          journal_entry_draft_id: string | null
          journal_entry_id: string | null
          period_month: string
        }
        Insert: {
          amount: number
          created_at?: string
          fixed_asset_id: string
          id?: string
          journal_entry_draft_id?: string | null
          journal_entry_id?: string | null
          period_month: string
        }
        Update: {
          amount?: number
          created_at?: string
          fixed_asset_id?: string
          id?: string
          journal_entry_draft_id?: string | null
          journal_entry_id?: string | null
          period_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "depreciation_entries_fixed_asset_id_fkey"
            columns: ["fixed_asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depreciation_entries_journal_entry_draft_id_fkey"
            columns: ["journal_entry_draft_id"]
            isOneToOne: false
            referencedRelation: "journal_entry_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depreciation_entries_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          created_at: string
          deleted_at: string | null
          discount_type: string
          id: string
          loyverse_discount_id: string
          money_amount: number | null
          name: string
          percentage: number | null
          raw: Json | null
          restricted_access: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          discount_type: string
          id?: string
          loyverse_discount_id: string
          money_amount?: number | null
          name: string
          percentage?: number | null
          raw?: Json | null
          restricted_access?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          discount_type?: string
          id?: string
          loyverse_discount_id?: string
          money_amount?: number | null
          name?: string
          percentage?: number | null
          raw?: Json | null
          restricted_access?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      expense_attachments: {
        Row: {
          created_at: string
          expense_id: string
          file_name: string
          file_path: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          expense_id: string
          file_name: string
          file_path: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          expense_id?: string
          file_name?: string
          file_path?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_attachments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "opex_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          accounting_treatment: string
          created_at: string
          default_amortization_months: number | null
          default_asset_category_id: string | null
          default_expense_account_id: string | null
          default_prepaid_account_id: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          accounting_treatment?: string
          created_at?: string
          default_amortization_months?: number | null
          default_asset_category_id?: string | null
          default_expense_account_id?: string | null
          default_prepaid_account_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          accounting_treatment?: string
          created_at?: string
          default_amortization_months?: number | null
          default_asset_category_id?: string | null
          default_expense_account_id?: string | null
          default_prepaid_account_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_default_asset_category_id_fkey"
            columns: ["default_asset_category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_default_expense_account_id_fkey"
            columns: ["default_expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_default_prepaid_account_id_fkey"
            columns: ["default_prepaid_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          date: string
          deleted_at: string | null
          id: string
          note: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          id?: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          id?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_assets: {
        Row: {
          accum_depreciation_account_id: string
          asset_account_id: string
          category_id: string | null
          cost: number
          created_at: string
          depreciation_expense_account_id: string
          disposed_at: string | null
          id: string
          name: string
          payment_status: string
          purchase_order_id: string | null
          purchased_date: string
          salvage_value: number
          schedule_status: string
          supplier_id: string | null
          updated_at: string
          useful_life_months: number
        }
        Insert: {
          accum_depreciation_account_id: string
          asset_account_id: string
          category_id?: string | null
          cost: number
          created_at?: string
          depreciation_expense_account_id: string
          disposed_at?: string | null
          id?: string
          name: string
          payment_status?: string
          purchase_order_id?: string | null
          purchased_date: string
          salvage_value?: number
          schedule_status?: string
          supplier_id?: string | null
          updated_at?: string
          useful_life_months: number
        }
        Update: {
          accum_depreciation_account_id?: string
          asset_account_id?: string
          category_id?: string | null
          cost?: number
          created_at?: string
          depreciation_expense_account_id?: string
          disposed_at?: string | null
          id?: string
          name?: string
          payment_status?: string
          purchase_order_id?: string | null
          purchased_date?: string
          salvage_value?: number
          schedule_status?: string
          supplier_id?: string | null
          updated_at?: string
          useful_life_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "fixed_assets_accum_depreciation_account_id_fkey"
            columns: ["accum_depreciation_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_asset_account_id_fkey"
            columns: ["asset_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_depreciation_expense_account_id_fkey"
            columns: ["depreciation_expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      income: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          date: string
          deleted_at: string | null
          id: string
          note: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          id?: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          id?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      incoming_items: {
        Row: {
          created_at: string
          date_received: string
          discount_amount: number
          id: string
          item_id: string
          item_name_snapshot: string
          notes: string | null
          order_id: string | null
          payment_status: string
          purchase_order_id: string | null
          quantity: number
          received_by: string
          received_by_email: string | null
          reference: string
          shipping_fee: number
          source: string
          status: string
          supplier: string | null
          supplier_id: string | null
          total_price: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          date_received: string
          discount_amount?: number
          id?: string
          item_id: string
          item_name_snapshot: string
          notes?: string | null
          order_id?: string | null
          payment_status?: string
          purchase_order_id?: string | null
          quantity: number
          received_by: string
          received_by_email?: string | null
          reference: string
          shipping_fee?: number
          source?: string
          status?: string
          supplier?: string | null
          supplier_id?: string | null
          total_price: number
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          date_received?: string
          discount_amount?: number
          id?: string
          item_id?: string
          item_name_snapshot?: string
          notes?: string | null
          order_id?: string | null
          payment_status?: string
          purchase_order_id?: string | null
          quantity?: number
          received_by?: string
          received_by_email?: string | null
          reference?: string
          shipping_fee?: number
          source?: string
          status?: string
          supplier?: string | null
          supplier_id?: string | null
          total_price?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incoming_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incoming_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_item_catalog"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "incoming_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incoming_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incoming_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "item_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incoming_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["component_variant_id"]
          },
          {
            foreignKeyName: "incoming_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["composite_variant_id"]
          },
          {
            foreignKeyName: "incoming_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_overview"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "incoming_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_item_catalog"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      inventory_levels: {
        Row: {
          available_qty: number
          created_at: string
          id: string
          in_production_qty: number
          in_stock: number
          incoming_qty: number
          low_stock_threshold: number | null
          on_hold_qty: number
          reserved_qty: number
          source_id: string | null
          source_updated_at: string | null
          store_id: string
          synced_at: string
          updated_at: string
          variant_id: string
        }
        Insert: {
          available_qty?: number
          created_at?: string
          id?: string
          in_production_qty?: number
          in_stock?: number
          incoming_qty?: number
          low_stock_threshold?: number | null
          on_hold_qty?: number
          reserved_qty?: number
          source_id?: string | null
          source_updated_at?: string | null
          store_id: string
          synced_at?: string
          updated_at?: string
          variant_id: string
        }
        Update: {
          available_qty?: number
          created_at?: string
          id?: string
          in_production_qty?: number
          in_stock?: number
          incoming_qty?: number
          low_stock_threshold?: number | null
          on_hold_qty?: number
          reserved_qty?: number
          source_id?: string | null
          source_updated_at?: string | null
          store_id?: string
          synced_at?: string
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_levels_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "inventory_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "item_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["component_variant_id"]
          },
          {
            foreignKeyName: "inventory_levels_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["composite_variant_id"]
          },
          {
            foreignKeyName: "inventory_levels_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_overview"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "inventory_levels_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_item_catalog"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          counterpart_status: string | null
          created_at: string
          id: string
          movement_type: string
          note: string | null
          occurred_at: string
          quantity_after: number | null
          quantity_before: number
          quantity_change: number
          source_id: string | null
          source_reference_id: string | null
          status: string
          store_id: string
          transfer_group_id: string | null
          variant_id: string
        }
        Insert: {
          counterpart_status?: string | null
          created_at?: string
          id?: string
          movement_type: string
          note?: string | null
          occurred_at?: string
          quantity_after?: number | null
          quantity_before: number
          quantity_change: number
          source_id?: string | null
          source_reference_id?: string | null
          status?: string
          store_id: string
          transfer_group_id?: string | null
          variant_id: string
        }
        Update: {
          counterpart_status?: string | null
          created_at?: string
          id?: string
          movement_type?: string
          note?: string | null
          occurred_at?: string
          quantity_after?: number | null
          quantity_before?: number
          quantity_change?: number
          source_id?: string | null
          source_reference_id?: string | null
          status?: string
          store_id?: string
          transfer_group_id?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "inventory_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "item_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["component_variant_id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["composite_variant_id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_overview"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_item_catalog"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      inventory_sources: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      item_accounting_mappings: {
        Row: {
          created_at: string
          expense_account_id: string | null
          id: string
          inventory_account_id: string | null
          item_id: string
          revenue_account_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          expense_account_id?: string | null
          id?: string
          inventory_account_id?: string | null
          item_id: string
          revenue_account_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          expense_account_id?: string | null
          id?: string
          inventory_account_id?: string | null
          item_id?: string
          revenue_account_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_accounting_mappings_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_accounting_mappings_inventory_account_id_fkey"
            columns: ["inventory_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_accounting_mappings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_accounting_mappings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "v_item_catalog"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "item_accounting_mappings_revenue_account_id_fkey"
            columns: ["revenue_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_accounting_mappings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      item_components: {
        Row: {
          component_variant_id: string
          composite_variant_id: string
          created_at: string
          id: string
          quantity: number
        }
        Insert: {
          component_variant_id: string
          composite_variant_id: string
          created_at?: string
          id?: string
          quantity?: number
        }
        Update: {
          component_variant_id?: string
          composite_variant_id?: string
          created_at?: string
          id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_components_component_variant_id_fkey"
            columns: ["component_variant_id"]
            isOneToOne: false
            referencedRelation: "item_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_components_component_variant_id_fkey"
            columns: ["component_variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["component_variant_id"]
          },
          {
            foreignKeyName: "item_components_component_variant_id_fkey"
            columns: ["component_variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["composite_variant_id"]
          },
          {
            foreignKeyName: "item_components_component_variant_id_fkey"
            columns: ["component_variant_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_overview"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "item_components_component_variant_id_fkey"
            columns: ["component_variant_id"]
            isOneToOne: false
            referencedRelation: "v_item_catalog"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "item_components_composite_variant_id_fkey"
            columns: ["composite_variant_id"]
            isOneToOne: false
            referencedRelation: "item_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_components_composite_variant_id_fkey"
            columns: ["composite_variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["component_variant_id"]
          },
          {
            foreignKeyName: "item_components_composite_variant_id_fkey"
            columns: ["composite_variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["composite_variant_id"]
          },
          {
            foreignKeyName: "item_components_composite_variant_id_fkey"
            columns: ["composite_variant_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_overview"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "item_components_composite_variant_id_fkey"
            columns: ["composite_variant_id"]
            isOneToOne: false
            referencedRelation: "v_item_catalog"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      item_modifiers: {
        Row: {
          created_at: string
          id: string
          item_id: string
          modifier_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          modifier_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          modifier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_modifiers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_modifiers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_item_catalog"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "item_modifiers_modifier_id_fkey"
            columns: ["modifier_id"]
            isOneToOne: false
            referencedRelation: "modifiers"
            referencedColumns: ["id"]
          },
        ]
      }
      item_variants: {
        Row: {
          barcode: string | null
          cost: number | null
          created_at: string
          default_price: number | null
          default_purchase_cost: number | null
          deleted_at: string | null
          id: string
          item_id: string
          loyverse_synced_at: string | null
          loyverse_variant_id: string | null
          option1_value: string | null
          option2_value: string | null
          option3_value: string | null
          pricing_type: string
          sku: string | null
          sync_error: string | null
          sync_status: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          cost?: number | null
          created_at?: string
          default_price?: number | null
          default_purchase_cost?: number | null
          deleted_at?: string | null
          id?: string
          item_id: string
          loyverse_synced_at?: string | null
          loyverse_variant_id?: string | null
          option1_value?: string | null
          option2_value?: string | null
          option3_value?: string | null
          pricing_type?: string
          sku?: string | null
          sync_error?: string | null
          sync_status?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          cost?: number | null
          created_at?: string
          default_price?: number | null
          default_purchase_cost?: number | null
          deleted_at?: string | null
          id?: string
          item_id?: string
          loyverse_synced_at?: string | null
          loyverse_variant_id?: string | null
          option1_value?: string | null
          option2_value?: string | null
          option3_value?: string | null
          pricing_type?: string
          sku?: string | null
          sync_error?: string | null
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_variants_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_variants_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_item_catalog"
            referencedColumns: ["item_id"]
          },
        ]
      }
      items: {
        Row: {
          ai_match_keywords: string | null
          category_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_available_for_sale: boolean
          item_type: string
          loyverse_item_id: string | null
          loyverse_synced_at: string | null
          name: string
          option1_name: string | null
          option2_name: string | null
          option3_name: string | null
          primary_supplier_id: string | null
          raw: Json | null
          sold_by: string
          sync_error: string | null
          sync_status: string
          track_stock: boolean
          updated_at: string
          use_production: boolean
        }
        Insert: {
          ai_match_keywords?: string | null
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available_for_sale?: boolean
          item_type?: string
          loyverse_item_id?: string | null
          loyverse_synced_at?: string | null
          name: string
          option1_name?: string | null
          option2_name?: string | null
          option3_name?: string | null
          primary_supplier_id?: string | null
          raw?: Json | null
          sold_by?: string
          sync_error?: string | null
          sync_status?: string
          track_stock?: boolean
          updated_at?: string
          use_production?: boolean
        }
        Update: {
          ai_match_keywords?: string | null
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available_for_sale?: boolean
          item_type?: string
          loyverse_item_id?: string | null
          loyverse_synced_at?: string | null
          name?: string
          option1_name?: string | null
          option2_name?: string | null
          option3_name?: string | null
          primary_supplier_id?: string | null
          raw?: Json | null
          sold_by?: string
          sync_error?: string | null
          sync_status?: string
          track_stock?: boolean
          updated_at?: string
          use_production?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_primary_supplier_id_fkey"
            columns: ["primary_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          id: string
          source_id: string | null
          source_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          entry_date?: string
          id?: string
          source_id?: string | null
          source_type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date?: string
          id?: string
          source_id?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_draft_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          debit: number
          draft_id: string
          id: string
          line_order: number
          memo: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          debit?: number
          draft_id: string
          id?: string
          line_order?: number
          memo?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          debit?: number
          draft_id?: string
          id?: string
          line_order?: number
          memo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_draft_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_draft_lines_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "journal_entry_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_drafts: {
        Row: {
          created_at: string
          description: string
          entry_date: string
          event_type: string
          id: string
          posted_journal_entry_id: string | null
          posting_date: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_event_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          entry_date?: string
          event_type: string
          id?: string
          posted_journal_entry_id?: string | null
          posting_date: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_event_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          entry_date?: string
          event_type?: string
          id?: string
          posted_journal_entry_id?: string | null
          posting_date?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_event_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_drafts_posted_journal_entry_id_fkey"
            columns: ["posted_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_drafts_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: true
            referencedRelation: "business_events"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          debit: number
          id: string
          journal_entry_id: string
          line_order: number
          memo: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          debit?: number
          id?: string
          journal_entry_id: string
          line_order?: number
          memo?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          debit?: number
          id?: string
          journal_entry_id?: string
          line_order?: number
          memo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_options: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          loyverse_modifier_option_id: string | null
          modifier_id: string
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          loyverse_modifier_option_id?: string | null
          modifier_id: string
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          loyverse_modifier_option_id?: string | null
          modifier_id?: string
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifier_options_modifier_id_fkey"
            columns: ["modifier_id"]
            isOneToOne: false
            referencedRelation: "modifiers"
            referencedColumns: ["id"]
          },
        ]
      }
      modifiers: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          loyverse_modifier_id: string | null
          name: string
          raw: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          loyverse_modifier_id?: string | null
          name: string
          raw?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          loyverse_modifier_id?: string | null
          name?: string
          raw?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      opex_expenses: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          expense_date: string
          expense_number: string
          id: string
          payment_status: string
          purchase_order_id: string | null
          source: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description: string
          expense_date?: string
          expense_number: string
          id?: string
          payment_status?: string
          purchase_order_id?: string | null
          source?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          expense_date?: string
          expense_number?: string
          id?: string
          payment_status?: string
          purchase_order_id?: string | null
          source?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opex_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opex_expenses_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opex_expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_modifiers: {
        Row: {
          created_at: string
          id: string
          modifier_id: string
          modifier_option_id: string
          name_snapshot: string | null
          order_item_id: string
          price_snapshot: number
        }
        Insert: {
          created_at?: string
          id?: string
          modifier_id: string
          modifier_option_id: string
          name_snapshot?: string | null
          order_item_id: string
          price_snapshot?: number
        }
        Update: {
          created_at?: string
          id?: string
          modifier_id?: string
          modifier_option_id?: string
          name_snapshot?: string | null
          order_item_id?: string
          price_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_modifiers_modifier_id_fkey"
            columns: ["modifier_id"]
            isOneToOne: false
            referencedRelation: "modifiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_modifiers_modifier_option_id_fkey"
            columns: ["modifier_option_id"]
            isOneToOne: false
            referencedRelation: "modifier_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_modifiers_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          completed_qty: number
          created_at: string
          discount_id: string | null
          id: string
          item_name_snapshot: string | null
          line_discount: number
          line_note: string | null
          order_id: string
          production_order_id: string | null
          quantity: number
          reserved_qty: number
          sku_snapshot: string | null
          unit_price: number
          variant_id: string
        }
        Insert: {
          completed_qty?: number
          created_at?: string
          discount_id?: string | null
          id?: string
          item_name_snapshot?: string | null
          line_discount?: number
          line_note?: string | null
          order_id: string
          production_order_id?: string | null
          quantity?: number
          reserved_qty?: number
          sku_snapshot?: string | null
          unit_price?: number
          variant_id: string
        }
        Update: {
          completed_qty?: number
          created_at?: string
          discount_id?: string | null
          id?: string
          item_name_snapshot?: string | null
          line_discount?: number
          line_note?: string | null
          order_id?: string
          production_order_id?: string | null
          quantity?: number
          reserved_qty?: number
          sku_snapshot?: string | null
          unit_price?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "item_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["component_variant_id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["composite_variant_id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_overview"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_item_catalog"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      order_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          order_id: string
          payment_date: string
          payment_type_id: string | null
          reference_no: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          order_id: string
          payment_date?: string
          payment_type_id?: string | null
          reference_no?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string
          payment_date?: string
          payment_type_id?: string | null
          reference_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payments_payment_type_id_fkey"
            columns: ["payment_type_id"]
            isOneToOne: false
            referencedRelation: "payment_types"
            referencedColumns: ["id"]
          },
        ]
      }
      order_shipments: {
        Row: {
          courier_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          fulfillment_type: string
          id: string
          note: string | null
          order_id: string
          receiver_address_line1: string | null
          receiver_barangay: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postal_code: string | null
          receiver_province: string | null
          shipment_number: string
          shipped_at: string | null
          shipping_cost: number | null
          shipping_fee_charged: number | null
          ships_to_customer: boolean | null
          status: string | null
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          courier_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          fulfillment_type?: string
          id?: string
          note?: string | null
          order_id: string
          receiver_address_line1?: string | null
          receiver_barangay?: string | null
          receiver_city?: string | null
          receiver_name?: string | null
          receiver_phone?: string | null
          receiver_postal_code?: string | null
          receiver_province?: string | null
          shipment_number: string
          shipped_at?: string | null
          shipping_cost?: number | null
          shipping_fee_charged?: number | null
          ships_to_customer?: boolean | null
          status?: string | null
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          courier_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          fulfillment_type?: string
          id?: string
          note?: string | null
          order_id?: string
          receiver_address_line1?: string | null
          receiver_barangay?: string | null
          receiver_city?: string | null
          receiver_name?: string | null
          receiver_phone?: string | null
          receiver_postal_code?: string | null
          receiver_province?: string | null
          shipment_number?: string
          shipped_at?: string | null
          shipping_cost?: number | null
          shipping_fee_charged?: number | null
          ships_to_customer?: boolean | null
          status?: string | null
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_shipments_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_shipments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          fulfillment_method: string | null
          id: string
          loyverse_receipt_id: string | null
          loyverse_receipt_number: string | null
          note: string | null
          on_hold_previous_status: string | null
          order_number: string
          payment_close_note: string | null
          payment_closed_at: string | null
          payment_closed_by: string | null
          payment_type_id: string | null
          receiver_address_line1: string | null
          receiver_barangay: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postal_code: string | null
          receiver_province: string | null
          same_as_customer: boolean
          status: string
          store_id: string | null
          subtotal: number
          sync_error: string | null
          sync_status: string
          synced_at: string | null
          target_date: string
          tip_amount: number
          total_discount: number
          total_money: number
          total_tax: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          fulfillment_method?: string | null
          id?: string
          loyverse_receipt_id?: string | null
          loyverse_receipt_number?: string | null
          note?: string | null
          on_hold_previous_status?: string | null
          order_number: string
          payment_close_note?: string | null
          payment_closed_at?: string | null
          payment_closed_by?: string | null
          payment_type_id?: string | null
          receiver_address_line1?: string | null
          receiver_barangay?: string | null
          receiver_city?: string | null
          receiver_name?: string | null
          receiver_phone?: string | null
          receiver_postal_code?: string | null
          receiver_province?: string | null
          same_as_customer?: boolean
          status?: string
          store_id?: string | null
          subtotal?: number
          sync_error?: string | null
          sync_status?: string
          synced_at?: string | null
          target_date: string
          tip_amount?: number
          total_discount?: number
          total_money?: number
          total_tax?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          fulfillment_method?: string | null
          id?: string
          loyverse_receipt_id?: string | null
          loyverse_receipt_number?: string | null
          note?: string | null
          on_hold_previous_status?: string | null
          order_number?: string
          payment_close_note?: string | null
          payment_closed_at?: string | null
          payment_closed_by?: string | null
          payment_type_id?: string | null
          receiver_address_line1?: string | null
          receiver_barangay?: string | null
          receiver_city?: string | null
          receiver_name?: string | null
          receiver_phone?: string | null
          receiver_postal_code?: string | null
          receiver_province?: string | null
          same_as_customer?: boolean
          status?: string
          store_id?: string | null
          subtotal?: number
          sync_error?: string | null
          sync_status?: string
          synced_at?: string | null
          target_date?: string
          tip_amount?: number
          total_discount?: number
          total_money?: number
          total_tax?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_sales_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "orders_payment_closed_by_fkey"
            columns: ["payment_closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payment_type_id_fkey"
            columns: ["payment_type_id"]
            isOneToOne: false
            referencedRelation: "payment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payable_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          paid_date: string
          payable_id: string
          payable_type: string
          payment_type_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_date?: string
          payable_id: string
          payable_type: string
          payment_type_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_date?: string
          payable_id?: string
          payable_type?: string
          payment_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payable_payments_payment_type_id_fkey"
            columns: ["payment_type_id"]
            isOneToOne: false
            referencedRelation: "payment_types"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_type_accounting_mappings: {
        Row: {
          account_id: string
          bank_account_id: string | null
          created_at: string
          id: string
          payment_type_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          bank_account_id?: string | null
          created_at?: string
          id?: string
          payment_type_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          bank_account_id?: string | null
          created_at?: string
          id?: string
          payment_type_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_type_accounting_mappings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_type_accounting_mappings_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_type_accounting_mappings_payment_type_id_fkey"
            columns: ["payment_type_id"]
            isOneToOne: true
            referencedRelation: "payment_types"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          loyverse_payment_type_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          loyverse_payment_type_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          loyverse_payment_type_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      prepaid_expense_schedule_entries: {
        Row: {
          amount: number
          created_at: string
          id: string
          journal_entry_draft_id: string | null
          journal_entry_id: string | null
          period_month: string
          schedule_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          journal_entry_draft_id?: string | null
          journal_entry_id?: string | null
          period_month: string
          schedule_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          journal_entry_draft_id?: string | null
          journal_entry_id?: string | null
          period_month?: string
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prepaid_expense_schedule_entries_journal_entry_draft_id_fkey"
            columns: ["journal_entry_draft_id"]
            isOneToOne: false
            referencedRelation: "journal_entry_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prepaid_expense_schedule_entries_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prepaid_expense_schedule_entries_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "prepaid_expense_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      prepaid_expense_schedules: {
        Row: {
          category_id: string
          created_at: string
          expense_account_id: string
          id: string
          monthly_amount: number
          next_posting_date: string
          opex_expense_id: string
          prepaid_account_id: string
          remaining_balance: number
          schedule_status: string
          start_date: string
          term_months: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          expense_account_id: string
          id?: string
          monthly_amount: number
          next_posting_date: string
          opex_expense_id: string
          prepaid_account_id: string
          remaining_balance: number
          schedule_status?: string
          start_date: string
          term_months: number
          total_amount: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          expense_account_id?: string
          id?: string
          monthly_amount?: number
          next_posting_date?: string
          opex_expense_id?: string
          prepaid_account_id?: string
          remaining_balance?: number
          schedule_status?: string
          start_date?: string
          term_months?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prepaid_expense_schedules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prepaid_expense_schedules_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prepaid_expense_schedules_opex_expense_id_fkey"
            columns: ["opex_expense_id"]
            isOneToOne: false
            referencedRelation: "opex_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prepaid_expense_schedules_prepaid_account_id_fkey"
            columns: ["prepaid_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          completed_qty: number
          created_at: string
          id: string
          item_name_snapshot: string | null
          modifiers_snapshot: Json
          notes: string | null
          order_id: string
          production_order_number: string
          quantity: number
          sku_snapshot: string | null
          status: string
          updated_at: string
          variant_id: string
        }
        Insert: {
          completed_qty?: number
          created_at?: string
          id?: string
          item_name_snapshot?: string | null
          modifiers_snapshot?: Json
          notes?: string | null
          order_id: string
          production_order_number: string
          quantity: number
          sku_snapshot?: string | null
          status?: string
          updated_at?: string
          variant_id: string
        }
        Update: {
          completed_qty?: number
          created_at?: string
          id?: string
          item_name_snapshot?: string | null
          modifiers_snapshot?: Json
          notes?: string | null
          order_id?: string
          production_order_number?: string
          quantity?: number
          sku_snapshot?: string | null
          status?: string
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "item_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["component_variant_id"]
          },
          {
            foreignKeyName: "production_orders_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["composite_variant_id"]
          },
          {
            foreignKeyName: "production_orders_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_overview"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "production_orders_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_item_catalog"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      profiles: {
        Row: {
          birthday: string | null
          contact_number: string | null
          created_at: string
          email: string | null
          full_name: string | null
          function_title: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          username: string
        }
        Insert: {
          birthday?: string | null
          contact_number?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          function_title?: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          username: string
        }
        Update: {
          birthday?: string | null
          contact_number?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          function_title?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          username?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          asset_category_id: string | null
          created_at: string
          description: string | null
          discount_amount: number
          expense_category_id: string | null
          id: string
          item_name_snapshot: string | null
          line_total: number
          note: string | null
          purchase_order_id: string
          quantity_ordered: number
          quantity_received: number
          unit_cost: number
          variant_id: string | null
        }
        Insert: {
          asset_category_id?: string | null
          created_at?: string
          description?: string | null
          discount_amount?: number
          expense_category_id?: string | null
          id?: string
          item_name_snapshot?: string | null
          line_total?: number
          note?: string | null
          purchase_order_id: string
          quantity_ordered: number
          quantity_received?: number
          unit_cost?: number
          variant_id?: string | null
        }
        Update: {
          asset_category_id?: string | null
          created_at?: string
          description?: string | null
          discount_amount?: number
          expense_category_id?: string | null
          id?: string
          item_name_snapshot?: string | null
          line_total?: number
          note?: string | null
          purchase_order_id?: string
          quantity_ordered?: number
          quantity_received?: number
          unit_cost?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_asset_category_id_fkey"
            columns: ["asset_category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_expense_category_id_fkey"
            columns: ["expense_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "item_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["component_variant_id"]
          },
          {
            foreignKeyName: "purchase_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["composite_variant_id"]
          },
          {
            foreignKeyName: "purchase_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_overview"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "purchase_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_item_catalog"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          discount_amount: number
          expected_date: string | null
          id: string
          note: string | null
          order_date: string
          po_type: string
          reference: string
          shipping_fee: number
          status: string
          store_id: string | null
          subtotal: number
          supplier_id: string | null
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          expected_date?: string | null
          id?: string
          note?: string | null
          order_date?: string
          po_type?: string
          reference: string
          shipping_fee?: number
          status?: string
          store_id?: string | null
          subtotal?: number
          supplier_id?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          expected_date?: string | null
          id?: string
          note?: string | null
          order_date?: string
          po_type?: string
          reference?: string
          shipping_fee?: number
          status?: string
          store_id?: string | null
          subtotal?: number
          supplier_id?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_item_modifiers: {
        Row: {
          created_at: string
          id: string
          modifier_id: string
          modifier_option_id: string
          name_snapshot: string | null
          price_snapshot: number
          quote_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          modifier_id: string
          modifier_option_id: string
          name_snapshot?: string | null
          price_snapshot?: number
          quote_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          modifier_id?: string
          modifier_option_id?: string
          name_snapshot?: string | null
          price_snapshot?: number
          quote_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_item_modifiers_modifier_id_fkey"
            columns: ["modifier_id"]
            isOneToOne: false
            referencedRelation: "modifiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_item_modifiers_modifier_option_id_fkey"
            columns: ["modifier_option_id"]
            isOneToOne: false
            referencedRelation: "modifier_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_item_modifiers_quote_item_id_fkey"
            columns: ["quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          created_at: string
          discount_id: string | null
          id: string
          item_name_snapshot: string | null
          line_discount: number
          line_note: string | null
          quantity: number
          quote_id: string
          sku_snapshot: string | null
          unit_price: number
          variant_id: string
        }
        Insert: {
          created_at?: string
          discount_id?: string | null
          id?: string
          item_name_snapshot?: string | null
          line_discount?: number
          line_note?: string | null
          quantity?: number
          quote_id: string
          sku_snapshot?: string | null
          unit_price?: number
          variant_id: string
        }
        Update: {
          created_at?: string
          discount_id?: string | null
          id?: string
          item_name_snapshot?: string | null
          line_discount?: number
          line_note?: string | null
          quantity?: number
          quote_id?: string
          sku_snapshot?: string | null
          unit_price?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "item_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["component_variant_id"]
          },
          {
            foreignKeyName: "quote_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["composite_variant_id"]
          },
          {
            foreignKeyName: "quote_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_overview"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "quote_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_item_catalog"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      quotes: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          converted_at: string | null
          converted_by: string | null
          converted_order_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          note: string | null
          quote_date: string
          quote_number: string
          status: string
          store_id: string | null
          subtotal: number
          total_discount: number
          total_money: number
          total_tax: number
          updated_at: string
          valid_until: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          converted_at?: string | null
          converted_by?: string | null
          converted_order_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          note?: string | null
          quote_date?: string
          quote_number: string
          status?: string
          store_id?: string | null
          subtotal?: number
          total_discount?: number
          total_money?: number
          total_tax?: number
          updated_at?: string
          valid_until: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          converted_at?: string | null
          converted_by?: string | null
          converted_order_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          note?: string | null
          quote_date?: string
          quote_number?: string
          status?: string
          store_id?: string | null
          subtotal?: number
          total_discount?: number
          total_money?: number
          total_tax?: number
          updated_at?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_converted_by_fkey"
            columns: ["converted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_sales_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "quotes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_line_items: {
        Row: {
          cost_at_sale: number | null
          created_at: string
          gross_total_money: number
          id: string
          item_name_snapshot: string | null
          line_note: string | null
          quantity: number
          receipt_id: string
          sku_snapshot: string | null
          total_discount: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          cost_at_sale?: number | null
          created_at?: string
          gross_total_money?: number
          id?: string
          item_name_snapshot?: string | null
          line_note?: string | null
          quantity?: number
          receipt_id: string
          sku_snapshot?: string | null
          total_discount?: number
          unit_price?: number
          variant_id?: string | null
        }
        Update: {
          cost_at_sale?: number | null
          created_at?: string
          gross_total_money?: number
          id?: string
          item_name_snapshot?: string | null
          line_note?: string | null
          quantity?: number
          receipt_id?: string
          sku_snapshot?: string | null
          total_discount?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_line_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_line_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "v_receipt_details"
            referencedColumns: ["receipt_id"]
          },
          {
            foreignKeyName: "receipt_line_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "item_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_line_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["component_variant_id"]
          },
          {
            foreignKeyName: "receipt_line_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["composite_variant_id"]
          },
          {
            foreignKeyName: "receipt_line_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_overview"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "receipt_line_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_item_catalog"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      receipt_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          paid_at: string | null
          payment_type: string
          receipt_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_type: string
          receipt_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_type?: string
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_payments_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_payments_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "v_receipt_details"
            referencedColumns: ["receipt_id"]
          },
        ]
      }
      receipts: {
        Row: {
          cancelled_at: string | null
          created_at: string
          customer_id: string | null
          id: string
          loyverse_employee_id: string | null
          loyverse_receipt_id: string | null
          note: string | null
          original_receipt_id: string | null
          points_deducted: number
          points_earned: number
          raw: Json | null
          receipt_date: string
          receipt_number: string | null
          receipt_type: string
          store_id: string | null
          synced_at: string
          total_discount: number
          total_money: number
          total_tax: number
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          loyverse_employee_id?: string | null
          loyverse_receipt_id?: string | null
          note?: string | null
          original_receipt_id?: string | null
          points_deducted?: number
          points_earned?: number
          raw?: Json | null
          receipt_date: string
          receipt_number?: string | null
          receipt_type?: string
          store_id?: string | null
          synced_at?: string
          total_discount?: number
          total_money?: number
          total_tax?: number
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          loyverse_employee_id?: string | null
          loyverse_receipt_id?: string | null
          note?: string | null
          original_receipt_id?: string | null
          points_deducted?: number
          points_earned?: number
          raw?: Json | null
          receipt_date?: string
          receipt_number?: string | null
          receipt_type?: string
          store_id?: string | null
          synced_at?: string
          total_discount?: number
          total_money?: number
          total_tax?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_sales_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "receipts_original_receipt_id_fkey"
            columns: ["original_receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_original_receipt_id_fkey"
            columns: ["original_receipt_id"]
            isOneToOne: false
            referencedRelation: "v_receipt_details"
            referencedColumns: ["receipt_id"]
          },
          {
            foreignKeyName: "receipts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_items: {
        Row: {
          created_at: string
          id: string
          note: string | null
          order_item_id: string
          quantity_shipped: number
          shipment_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          order_item_id: string
          quantity_shipped: number
          shipment_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          order_item_id?: string
          quantity_shipped?: number
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "order_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_packaging_items: {
        Row: {
          created_at: string
          id: string
          note: string | null
          quantity_used: number
          shipment_id: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          quantity_used: number
          shipment_id: string
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          quantity_used?: number
          shipment_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_packaging_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "order_shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_packaging_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "item_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_packaging_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["component_variant_id"]
          },
          {
            foreignKeyName: "shipment_packaging_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_composite_bom"
            referencedColumns: ["composite_variant_id"]
          },
          {
            foreignKeyName: "shipment_packaging_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_overview"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "shipment_packaging_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_item_catalog"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          loyverse_store_id: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          loyverse_store_id?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          loyverse_store_id?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          note: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          note?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          note?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sync_state: {
        Row: {
          last_cursor: string | null
          last_error: string | null
          last_run_status: string | null
          last_synced_at: string | null
          resource: string
          updated_at: string
        }
        Insert: {
          last_cursor?: string | null
          last_error?: string | null
          last_run_status?: string | null
          last_synced_at?: string | null
          resource: string
          updated_at?: string
        }
        Update: {
          last_cursor?: string | null
          last_error?: string | null
          last_run_status?: string | null
          last_synced_at?: string | null
          resource?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_account_mappings: {
        Row: {
          account_id: string | null
          id: string
          label: string
          mapping_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id?: string | null
          id?: string
          label: string
          mapping_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string | null
          id?: string
          label?: string
          mapping_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_account_mappings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          rate_percent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          rate_percent: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          rate_percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      web_faqs: {
        Row: {
          answer: string
          category: string | null
          created_at: string
          id: string
          published: boolean
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string | null
          created_at?: string
          id?: string
          published?: boolean
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string | null
          created_at?: string
          id?: string
          published?: boolean
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      web_quote_requests: {
        Row: {
          converted_quote_id: string | null
          created_at: string
          customization_details: string | null
          email: string | null
          full_name: string
          id: string
          needed_by_date: string | null
          phone: string | null
          product_category: string | null
          quantity: string | null
          shipping_address: string | null
          status: string
          submitter_ip: unknown
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          converted_quote_id?: string | null
          created_at?: string
          customization_details?: string | null
          email?: string | null
          full_name: string
          id?: string
          needed_by_date?: string | null
          phone?: string | null
          product_category?: string | null
          quantity?: string | null
          shipping_address?: string | null
          status?: string
          submitter_ip?: unknown
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          converted_quote_id?: string | null
          created_at?: string
          customization_details?: string | null
          email?: string | null
          full_name?: string
          id?: string
          needed_by_date?: string | null
          phone?: string | null
          product_category?: string | null
          quantity?: string | null
          shipping_address?: string | null
          status?: string
          submitter_ip?: unknown
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_requests_converted_quote_id_fkey"
            columns: ["converted_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      web_testimonials: {
        Row: {
          author_name: string
          author_role: string | null
          avatar_url: string | null
          created_at: string
          id: string
          published: boolean
          quote: string
          rating: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          author_name: string
          author_role?: string | null
          avatar_url?: string | null
          created_at?: string
          id?: string
          published?: boolean
          quote: string
          rating?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          author_name?: string
          author_role?: string | null
          avatar_url?: string | null
          created_at?: string
          id?: string
          published?: boolean
          quote?: string
          rating?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_composite_bom: {
        Row: {
          component_item_name: string | null
          component_variant_id: string | null
          composite_item_name: string | null
          composite_variant_id: string | null
          quantity: number | null
        }
        Relationships: []
      }
      v_customer_sales_summary: {
        Row: {
          customer_id: string | null
          customer_name: string | null
          email: string | null
          last_purchase_at: string | null
          lifetime_spent: number | null
          total_receipts: number | null
        }
        Relationships: []
      }
      v_inventory_overview: {
        Row: {
          in_stock: number | null
          inventory_level_id: string | null
          is_low_stock: boolean | null
          item_name: string | null
          low_stock_threshold: number | null
          sku: string | null
          source_name: string | null
          source_updated_at: string | null
          store_name: string | null
          synced_at: string | null
          variant_id: string | null
        }
        Relationships: []
      }
      v_item_catalog: {
        Row: {
          barcode: string | null
          category_name: string | null
          cost: number | null
          default_price: number | null
          is_available_for_sale: boolean | null
          item_id: string | null
          item_name: string | null
          item_type: string | null
          loyverse_item_id: string | null
          loyverse_variant_id: string | null
          margin: number | null
          sku: string | null
          variant_id: string | null
        }
        Relationships: []
      }
      v_receipt_details: {
        Row: {
          cost_at_sale: number | null
          customer_name: string | null
          gross_total_money: number | null
          item_name_snapshot: string | null
          quantity: number | null
          receipt_date: string | null
          receipt_id: string | null
          receipt_number: string | null
          receipt_type: string | null
          sku_snapshot: string | null
          store_name: string | null
          total_discount: number | null
          unit_price: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _account_rollup: {
        Args: { p_end: string; p_start: string }
        Returns: {
          account_id: string
          own_credit: number
          own_debit: number
          subtree_credit: number
          subtree_debit: number
        }[]
      }
      _account_tree: {
        Args: never
        Returns: {
          account_id: string
          account_name: string
          account_number: string
          category: string
          depth: number
          is_postable: boolean
          sort_path: string[]
        }[]
      }
      _deduct_shipment_stock: {
        Args: {
          p_shipment_id: string
          p_shipment_number: string
          p_store_id: string
        }
        Returns: undefined
      }
      _record_expense_with_treatment: {
        Args: {
          p_amount: number
          p_category_id: string
          p_description: string
          p_expense_date: string
          p_payment_status: string
          p_purchase_order_id: string
          p_salvage_override?: number
          p_source: string
          p_supplier_id: string
          p_term_override?: number
          p_treatment_override?: string
          p_useful_life_override?: number
        }
        Returns: Json
      }
      add_expense_attachment: {
        Args: { p_expense_id: string; p_file_name: string; p_file_path: string }
        Returns: string
      }
      add_production_completed_qty: {
        Args: { p_production_order_id: string; p_qty: number }
        Returns: {
          completed_qty: number
          created_at: string
          id: string
          item_name_snapshot: string | null
          modifiers_snapshot: Json
          notes: string | null
          order_id: string
          production_order_number: string
          quantity: number
          sku_snapshot: string | null
          status: string
          updated_at: string
          variant_id: string
        }
        SetofOptions: {
          from: "*"
          to: "production_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      adjust_incoming_qty: {
        Args: {
          p_note?: string
          p_quantity_change: number
          p_store_id: string
          p_variant_id: string
        }
        Returns: {
          available_qty: number
          created_at: string
          id: string
          in_production_qty: number
          in_stock: number
          incoming_qty: number
          low_stock_threshold: number | null
          on_hold_qty: number
          reserved_qty: number
          source_id: string | null
          source_updated_at: string | null
          store_id: string
          synced_at: string
          updated_at: string
          variant_id: string
        }
        SetofOptions: {
          from: "*"
          to: "inventory_levels"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      adjust_order_items: {
        Args: {
          p_customer_id?: string
          p_fulfillment_method?: string
          p_lines: Json
          p_note?: string
          p_order_id: string
          p_receiver_address_line1?: string
          p_receiver_barangay?: string
          p_receiver_city?: string
          p_receiver_name?: string
          p_receiver_phone?: string
          p_receiver_postal_code?: string
          p_receiver_province?: string
          p_same_as_customer?: boolean
        }
        Returns: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          fulfillment_method: string | null
          id: string
          loyverse_receipt_id: string | null
          loyverse_receipt_number: string | null
          note: string | null
          on_hold_previous_status: string | null
          order_number: string
          payment_close_note: string | null
          payment_closed_at: string | null
          payment_closed_by: string | null
          payment_type_id: string | null
          receiver_address_line1: string | null
          receiver_barangay: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postal_code: string | null
          receiver_province: string | null
          same_as_customer: boolean
          status: string
          store_id: string | null
          subtotal: number
          sync_error: string | null
          sync_status: string
          synced_at: string | null
          target_date: string
          tip_amount: number
          total_discount: number
          total_money: number
          total_tax: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      adjust_stock: {
        Args: {
          p_note?: string
          p_qty_delta: number
          p_reason?: string
          p_store_id?: string
          p_variant_id: string
        }
        Returns: {
          counterpart_status: string | null
          created_at: string
          id: string
          movement_type: string
          note: string | null
          occurred_at: string
          quantity_after: number | null
          quantity_before: number
          quantity_change: number
          source_id: string | null
          source_reference_id: string | null
          status: string
          store_id: string
          transfer_group_id: string | null
          variant_id: string
        }
        SetofOptions: {
          from: "*"
          to: "inventory_movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_and_post_journal_entry_draft: {
        Args: { p_draft_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          id: string
          source_id: string | null
          source_type: string
        }
        SetofOptions: {
          from: "*"
          to: "journal_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_item: { Args: { p_item_id: string }; Returns: undefined }
      cancel_order: {
        Args: { p_order_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          fulfillment_method: string | null
          id: string
          loyverse_receipt_id: string | null
          loyverse_receipt_number: string | null
          note: string | null
          on_hold_previous_status: string | null
          order_number: string
          payment_close_note: string | null
          payment_closed_at: string | null
          payment_closed_by: string | null
          payment_type_id: string | null
          receiver_address_line1: string | null
          receiver_barangay: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postal_code: string | null
          receiver_province: string | null
          same_as_customer: boolean
          status: string
          store_id: string | null
          subtotal: number
          sync_error: string | null
          sync_status: string
          synced_at: string | null
          target_date: string
          tip_amount: number
          total_discount: number
          total_money: number
          total_tax: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_production_order: {
        Args: { p_production_order_id: string }
        Returns: {
          completed_qty: number
          created_at: string
          id: string
          item_name_snapshot: string | null
          modifiers_snapshot: Json
          notes: string | null
          order_id: string
          production_order_number: string
          quantity: number
          sku_snapshot: string | null
          status: string
          updated_at: string
          variant_id: string
        }
        SetofOptions: {
          from: "*"
          to: "production_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_order_payment: {
        Args: { p_note?: string; p_order_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          fulfillment_method: string | null
          id: string
          loyverse_receipt_id: string | null
          loyverse_receipt_number: string | null
          note: string | null
          on_hold_previous_status: string | null
          order_number: string
          payment_close_note: string | null
          payment_closed_at: string | null
          payment_closed_by: string | null
          payment_type_id: string | null
          receiver_address_line1: string | null
          receiver_barangay: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postal_code: string | null
          receiver_province: string | null
          same_as_customer: boolean
          status: string
          store_id: string | null
          subtotal: number
          sync_error: string | null
          sync_status: string
          synced_at: string | null
          target_date: string
          tip_amount: number
          total_discount: number
          total_money: number
          total_tax: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_production_order: {
        Args: { p_production_order_id: string }
        Returns: {
          completed_qty: number
          created_at: string
          id: string
          item_name_snapshot: string | null
          modifiers_snapshot: Json
          notes: string | null
          order_id: string
          production_order_number: string
          quantity: number
          sku_snapshot: string | null
          status: string
          updated_at: string
          variant_id: string
        }
        SetofOptions: {
          from: "*"
          to: "production_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      convert_quote_to_order: {
        Args: { p_quote_id: string; p_target_date: string }
        Returns: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          fulfillment_method: string | null
          id: string
          loyverse_receipt_id: string | null
          loyverse_receipt_number: string | null
          note: string | null
          on_hold_previous_status: string | null
          order_number: string
          payment_close_note: string | null
          payment_closed_at: string | null
          payment_closed_by: string | null
          payment_type_id: string | null
          receiver_address_line1: string | null
          receiver_barangay: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postal_code: string | null
          receiver_province: string | null
          same_as_customer: boolean
          status: string
          store_id: string | null
          subtotal: number
          sync_error: string | null
          sync_status: string
          synced_at: string | null
          target_date: string
          tip_amount: number
          total_discount: number
          total_money: number
          total_tax: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_order: {
        Args: {
          p_customer_id?: string
          p_fulfillment_method?: string
          p_lines: Json
          p_note?: string
          p_receiver_address_line1?: string
          p_receiver_barangay?: string
          p_receiver_city?: string
          p_receiver_name?: string
          p_receiver_phone?: string
          p_receiver_postal_code?: string
          p_receiver_province?: string
          p_same_as_customer?: boolean
          p_target_date: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          fulfillment_method: string | null
          id: string
          loyverse_receipt_id: string | null
          loyverse_receipt_number: string | null
          note: string | null
          on_hold_previous_status: string | null
          order_number: string
          payment_close_note: string | null
          payment_closed_at: string | null
          payment_closed_by: string | null
          payment_type_id: string | null
          receiver_address_line1: string | null
          receiver_barangay: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postal_code: string | null
          receiver_province: string | null
          same_as_customer: boolean
          status: string
          store_id: string | null
          subtotal: number
          sync_error: string | null
          sync_status: string
          synced_at: string | null
          target_date: string
          tip_amount: number
          total_discount: number
          total_money: number
          total_tax: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_shipment: {
        Args: {
          p_courier_id?: string
          p_fulfillment_type?: string
          p_items?: Json
          p_note?: string
          p_order_id: string
          p_packaging_items?: Json
          p_receiver_address_line1?: string
          p_receiver_barangay?: string
          p_receiver_city?: string
          p_receiver_name?: string
          p_receiver_phone?: string
          p_receiver_postal_code?: string
          p_receiver_province?: string
          p_shipping_cost?: number
          p_shipping_fee_charged?: number
          p_ships_to_customer?: boolean
          p_tracking_number?: string
        }
        Returns: {
          courier_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          fulfillment_type: string
          id: string
          note: string | null
          order_id: string
          receiver_address_line1: string | null
          receiver_barangay: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postal_code: string | null
          receiver_province: string | null
          shipment_number: string
          shipped_at: string | null
          shipping_cost: number | null
          shipping_fee_charged: number | null
          ships_to_customer: boolean | null
          status: string | null
          tracking_number: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "order_shipments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      deduct_stock_out: {
        Args: {
          p_from_status?: string
          p_note?: string
          p_quantity: number
          p_store_id: string
          p_variant_id: string
        }
        Returns: {
          available_qty: number
          created_at: string
          id: string
          in_production_qty: number
          in_stock: number
          incoming_qty: number
          low_stock_threshold: number | null
          on_hold_qty: number
          reserved_qty: number
          source_id: string | null
          source_updated_at: string | null
          store_id: string
          synced_at: string
          updated_at: string
          variant_id: string
        }
        SetofOptions: {
          from: "*"
          to: "inventory_levels"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_expense: { Args: { p_id: string }; Returns: undefined }
      extend_expense_schedule: {
        Args: { p_additional_months: number; p_id: string; p_type: string }
        Returns: undefined
      }
      generate_draft_journal_entries: { Args: never; Returns: number }
      generate_due_prepaid_postings: { Args: never; Returns: number }
      get_balance_sheet: {
        Args: { p_as_of?: string }
        Returns: {
          account_id: string
          account_name: string
          account_number: string
          amount: number
          category: string
          depth: number
          is_postable: boolean
          rollup_amount: number
        }[]
      }
      get_email_for_username: { Args: { p_username: string }; Returns: string }
      get_income_statement: {
        Args: { p_end: string; p_start: string }
        Returns: {
          account_id: string
          account_name: string
          account_number: string
          amount: number
          category: string
          depth: number
          is_postable: boolean
          rollup_amount: number
        }[]
      }
      get_trial_balance: {
        Args: { p_as_of?: string }
        Returns: {
          account_id: string
          account_name: string
          account_number: string
          category: string
          credit_balance: number
          debit_balance: number
          depth: number
          is_postable: boolean
          rollup_credit_balance: number
          rollup_debit_balance: number
        }[]
      }
      hold_order: {
        Args: { p_order_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          fulfillment_method: string | null
          id: string
          loyverse_receipt_id: string | null
          loyverse_receipt_number: string | null
          note: string | null
          on_hold_previous_status: string | null
          order_number: string
          payment_close_note: string | null
          payment_closed_at: string | null
          payment_closed_by: string | null
          payment_type_id: string | null
          receiver_address_line1: string | null
          receiver_barangay: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postal_code: string | null
          receiver_province: string | null
          same_as_customer: boolean
          status: string
          store_id: string | null
          subtotal: number
          sync_error: string | null
          sync_status: string
          synced_at: string | null
          target_date: string
          tip_amount: number
          total_discount: number
          total_money: number
          total_tax: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      log_credit_card_installment_payment: {
        Args: {
          p_interest_amount?: number
          p_notes?: string
          p_paid_date?: string
          p_payment_type_id: string
          p_principal_amount: number
        }
        Returns: {
          created_at: string
          id: string
          interest_amount: number
          notes: string | null
          paid_by: string | null
          paid_date: string
          payment_type_id: string
          principal_amount: number
        }
        SetofOptions: {
          from: "*"
          to: "credit_card_installment_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      log_payable_payment: {
        Args: {
          p_amount: number
          p_notes?: string
          p_paid_date?: string
          p_payable_id: string
          p_payable_type: string
          p_payment_type_id: string
        }
        Returns: string
      }
      mark_delivered: {
        Args: { p_order_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          fulfillment_method: string | null
          id: string
          loyverse_receipt_id: string | null
          loyverse_receipt_number: string | null
          note: string | null
          on_hold_previous_status: string | null
          order_number: string
          payment_close_note: string | null
          payment_closed_at: string | null
          payment_closed_by: string | null
          payment_type_id: string | null
          receiver_address_line1: string | null
          receiver_barangay: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postal_code: string | null
          receiver_province: string | null
          same_as_customer: boolean
          status: string
          store_id: string | null
          subtotal: number
          sync_error: string | null
          sync_status: string
          synced_at: string | null
          target_date: string
          tip_amount: number
          total_discount: number
          total_money: number
          total_tax: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_picked_up: {
        Args: { p_order_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          fulfillment_method: string | null
          id: string
          loyverse_receipt_id: string | null
          loyverse_receipt_number: string | null
          note: string | null
          on_hold_previous_status: string | null
          order_number: string
          payment_close_note: string | null
          payment_closed_at: string | null
          payment_closed_by: string | null
          payment_type_id: string | null
          receiver_address_line1: string | null
          receiver_barangay: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postal_code: string | null
          receiver_province: string | null
          same_as_customer: boolean
          status: string
          store_id: string | null
          subtotal: number
          sync_error: string | null
          sync_status: string
          synced_at: string | null
          target_date: string
          tip_amount: number
          total_discount: number
          total_money: number
          total_tax: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_ready_for_shipping: {
        Args: { p_order_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          fulfillment_method: string | null
          id: string
          loyverse_receipt_id: string | null
          loyverse_receipt_number: string | null
          note: string | null
          on_hold_previous_status: string | null
          order_number: string
          payment_close_note: string | null
          payment_closed_at: string | null
          payment_closed_by: string | null
          payment_type_id: string | null
          receiver_address_line1: string | null
          receiver_barangay: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postal_code: string | null
          receiver_province: string | null
          same_as_customer: boolean
          status: string
          store_id: string | null
          subtotal: number
          sync_error: string | null
          sync_status: string
          synced_at: string | null
          target_date: string
          tip_amount: number
          total_discount: number
          total_money: number
          total_tax: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_shipment_delivered: {
        Args: { p_shipment_id: string }
        Returns: {
          courier_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          fulfillment_type: string
          id: string
          note: string | null
          order_id: string
          receiver_address_line1: string | null
          receiver_barangay: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postal_code: string | null
          receiver_province: string | null
          shipment_number: string
          shipped_at: string | null
          shipping_cost: number | null
          shipping_fee_charged: number | null
          ships_to_customer: boolean | null
          status: string | null
          tracking_number: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "order_shipments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_shipment_picked_up: {
        Args: { p_shipment_id: string }
        Returns: {
          courier_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          fulfillment_type: string
          id: string
          note: string | null
          order_id: string
          receiver_address_line1: string | null
          receiver_barangay: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postal_code: string | null
          receiver_province: string | null
          shipment_number: string
          shipped_at: string | null
          shipping_cost: number | null
          shipping_fee_charged: number | null
          ships_to_customer: boolean | null
          status: string | null
          tracking_number: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "order_shipments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_shipment_shipped: {
        Args: { p_shipment_id: string }
        Returns: {
          courier_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          fulfillment_type: string
          id: string
          note: string | null
          order_id: string
          receiver_address_line1: string | null
          receiver_barangay: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postal_code: string | null
          receiver_province: string | null
          shipment_number: string
          shipped_at: string | null
          shipping_cost: number | null
          shipping_fee_charged: number | null
          ships_to_customer: boolean | null
          status: string | null
          tracking_number: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "order_shipments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      override_reserved_qty: {
        Args: { p_order_id: string; p_updates: Json }
        Returns: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          fulfillment_method: string | null
          id: string
          loyverse_receipt_id: string | null
          loyverse_receipt_number: string | null
          note: string | null
          on_hold_previous_status: string | null
          order_number: string
          payment_close_note: string | null
          payment_closed_at: string | null
          payment_closed_by: string | null
          payment_type_id: string | null
          receiver_address_line1: string | null
          receiver_barangay: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postal_code: string | null
          receiver_province: string | null
          same_as_customer: boolean
          status: string
          store_id: string | null
          subtotal: number
          sync_error: string | null
          sync_status: string
          synced_at: string | null
          target_date: string
          tip_amount: number
          total_discount: number
          total_money: number
          total_tax: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pause_expense_schedule: {
        Args: { p_id: string; p_type: string }
        Returns: undefined
      }
      post_journal_entry: {
        Args: {
          p_description: string
          p_entry_date: string
          p_lines: Json
          p_source_id?: string
          p_source_type?: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          id: string
          source_id: string | null
          source_type: string
        }
        SetofOptions: {
          from: "*"
          to: "journal_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      receive_asset_purchase_order: {
        Args: { p_lines: Json; p_purchase_order_id: string }
        Returns: undefined
      }
      receive_expense_purchase_order: {
        Args: { p_lines: Json; p_purchase_order_id: string }
        Returns: undefined
      }
      receive_purchase_order: {
        Args: { p_lines: Json; p_purchase_order_id: string }
        Returns: undefined
      }
      recompute_order_status: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      recompute_shipping_status: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      record_direct_expense: {
        Args: {
          p_amount: number
          p_category_id: string
          p_description: string
          p_expense_date?: string
          p_payment_status?: string
          p_salvage_override?: number
          p_supplier_id?: string
          p_term_override?: number
          p_treatment_override?: string
          p_useful_life_override?: number
        }
        Returns: Json
      }
      reject_journal_entry_draft: {
        Args: { p_draft_id: string; p_reason?: string }
        Returns: {
          created_at: string
          description: string
          entry_date: string
          event_type: string
          id: string
          posted_journal_entry_id: string | null
          posting_date: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_event_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "journal_entry_drafts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_to_scrap: {
        Args: {
          p_note?: string
          p_quantity: number
          p_store_id: string
          p_variant_id: string
        }
        Returns: {
          available_qty: number
          created_at: string
          id: string
          in_production_qty: number
          in_stock: number
          incoming_qty: number
          low_stock_threshold: number | null
          on_hold_qty: number
          reserved_qty: number
          source_id: string | null
          source_updated_at: string | null
          store_id: string
          synced_at: string
          updated_at: string
          variant_id: string
        }
        SetofOptions: {
          from: "*"
          to: "inventory_levels"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resume_expense_schedule: {
        Args: { p_id: string; p_type: string }
        Returns: undefined
      }
      resume_order: {
        Args: { p_order_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          fulfillment_method: string | null
          id: string
          loyverse_receipt_id: string | null
          loyverse_receipt_number: string | null
          note: string | null
          on_hold_previous_status: string | null
          order_number: string
          payment_close_note: string | null
          payment_closed_at: string | null
          payment_closed_by: string | null
          payment_type_id: string | null
          receiver_address_line1: string | null
          receiver_barangay: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postal_code: string | null
          receiver_province: string | null
          same_as_customer: boolean
          status: string
          store_id: string | null
          subtotal: number
          sync_error: string | null
          sync_status: string
          synced_at: string | null
          target_date: string
          tip_amount: number
          total_discount: number
          total_money: number
          total_tax: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reverse_journal_entry: {
        Args: { p_entry_id: string; p_reason: string }
        Returns: {
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          id: string
          source_id: string | null
          source_type: string
        }
        SetofOptions: {
          from: "*"
          to: "journal_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      run_monthly_depreciation: {
        Args: { p_period: string }
        Returns: {
          amount: number
          created_at: string
          fixed_asset_id: string
          id: string
          journal_entry_draft_id: string | null
          journal_entry_id: string | null
          period_month: string
        }[]
        SetofOptions: {
          from: "*"
          to: "depreciation_entries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      ship_order: {
        Args: {
          p_courier_id?: string
          p_note?: string
          p_order_id: string
          p_shipping_cost?: number
          p_shipping_fee_charged?: number
          p_tracking_number?: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          fulfillment_method: string | null
          id: string
          loyverse_receipt_id: string | null
          loyverse_receipt_number: string | null
          note: string | null
          on_hold_previous_status: string | null
          order_number: string
          payment_close_note: string | null
          payment_closed_at: string | null
          payment_closed_by: string | null
          payment_type_id: string | null
          receiver_address_line1: string | null
          receiver_barangay: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postal_code: string | null
          receiver_province: string | null
          same_as_customer: boolean
          status: string
          store_id: string | null
          subtotal: number
          sync_error: string | null
          sync_status: string
          synced_at: string | null
          target_date: string
          tip_amount: number
          total_discount: number
          total_money: number
          total_tax: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_production: {
        Args: { p_order_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          fulfillment_method: string | null
          id: string
          loyverse_receipt_id: string | null
          loyverse_receipt_number: string | null
          note: string | null
          on_hold_previous_status: string | null
          order_number: string
          payment_close_note: string | null
          payment_closed_at: string | null
          payment_closed_by: string | null
          payment_type_id: string | null
          receiver_address_line1: string | null
          receiver_barangay: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postal_code: string | null
          receiver_province: string | null
          same_as_customer: boolean
          status: string
          store_id: string | null
          subtotal: number
          sync_error: string | null
          sync_status: string
          synced_at: string | null
          target_date: string
          tip_amount: number
          total_discount: number
          total_money: number
          total_tax: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_production_order: {
        Args: { p_production_order_id: string }
        Returns: {
          completed_qty: number
          created_at: string
          id: string
          item_name_snapshot: string | null
          modifiers_snapshot: Json
          notes: string | null
          order_id: string
          production_order_number: string
          quantity: number
          sku_snapshot: string | null
          status: string
          updated_at: string
          variant_id: string
        }
        SetofOptions: {
          from: "*"
          to: "production_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      terminate_expense_schedule: {
        Args: { p_id: string; p_termination_date?: string; p_type: string }
        Returns: Json
      }
      transfer_stock_status: {
        Args: {
          p_from_status: string
          p_note?: string
          p_quantity: number
          p_store_id: string
          p_to_status: string
          p_variant_id: string
        }
        Returns: {
          available_qty: number
          created_at: string
          id: string
          in_production_qty: number
          in_stock: number
          incoming_qty: number
          low_stock_threshold: number | null
          on_hold_qty: number
          reserved_qty: number
          source_id: string | null
          source_updated_at: string | null
          store_id: string
          synced_at: string
          updated_at: string
          variant_id: string
        }
        SetofOptions: {
          from: "*"
          to: "inventory_levels"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_completed_qty: {
        Args: { p_order_id: string; p_updates: Json }
        Returns: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          fulfillment_method: string | null
          id: string
          loyverse_receipt_id: string | null
          loyverse_receipt_number: string | null
          note: string | null
          on_hold_previous_status: string | null
          order_number: string
          payment_close_note: string | null
          payment_closed_at: string | null
          payment_closed_by: string | null
          payment_type_id: string | null
          receiver_address_line1: string | null
          receiver_barangay: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postal_code: string | null
          receiver_province: string | null
          same_as_customer: boolean
          status: string
          store_id: string | null
          subtotal: number
          sync_error: string | null
          sync_status: string
          synced_at: string | null
          target_date: string
          tip_amount: number
          total_discount: number
          total_money: number
          total_tax: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_direct_expense: {
        Args: {
          p_amount: number
          p_category_id: string
          p_description: string
          p_expense_date: string
          p_id: string
          p_supplier_id?: string
        }
        Returns: undefined
      }
      update_journal_entry_draft: {
        Args: {
          p_description: string
          p_draft_id: string
          p_lines: Json
          p_posting_date?: string
        }
        Returns: {
          created_at: string
          description: string
          entry_date: string
          event_type: string
          id: string
          posted_journal_entry_id: string | null
          posting_date: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_event_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "journal_entry_drafts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_shipment: {
        Args: {
          p_courier_id?: string
          p_fulfillment_type?: string
          p_items?: Json
          p_note?: string
          p_packaging_items?: Json
          p_receiver_address_line1?: string
          p_receiver_barangay?: string
          p_receiver_city?: string
          p_receiver_name?: string
          p_receiver_phone?: string
          p_receiver_postal_code?: string
          p_receiver_province?: string
          p_shipment_id: string
          p_shipping_cost?: number
          p_shipping_fee_charged?: number
          p_ships_to_customer?: boolean
          p_tracking_number?: string
        }
        Returns: {
          courier_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          fulfillment_type: string
          id: string
          note: string | null
          order_id: string
          receiver_address_line1: string | null
          receiver_barangay: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postal_code: string | null
          receiver_province: string | null
          shipment_number: string
          shipped_at: string | null
          shipping_cost: number | null
          shipping_fee_charged: number | null
          ships_to_customer: boolean | null
          status: string | null
          tracking_number: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "order_shipments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_item: {
        Args: {
          p_category_id: string
          p_components?: Json
          p_description: string
          p_is_available_for_sale: boolean
          p_item_id: string
          p_item_type: string
          p_modifier_ids?: string[]
          p_name: string
          p_option1_name: string
          p_option2_name: string
          p_option3_name: string
          p_primary_supplier_id: string
          p_sold_by: string
          p_store_id?: string
          p_track_stock: boolean
          p_variants: Json
        }
        Returns: {
          ai_match_keywords: string | null
          category_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_available_for_sale: boolean
          item_type: string
          loyverse_item_id: string | null
          loyverse_synced_at: string | null
          name: string
          option1_name: string | null
          option2_name: string | null
          option3_name: string | null
          primary_supplier_id: string | null
          raw: Json | null
          sold_by: string
          sync_error: string | null
          sync_status: string
          track_stock: boolean
          updated_at: string
          use_production: boolean
        }
        SetofOptions: {
          from: "*"
          to: "items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      user_role: "admin" | "encoder" | "manager" | "cashier" | "viewer"
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
      user_role: ["admin", "encoder", "manager", "cashier", "viewer"],
    },
  },
} as const
