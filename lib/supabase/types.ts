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
          account_number: number
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_number: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_number?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
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
      categories: {
        Row: {
          color: string | null
          created_at: string
          deleted_at: string | null
          id: string
          loyverse_category_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          loyverse_category_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          loyverse_category_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
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
          journal_entry_id: string | null
          period_month: string
        }
        Insert: {
          amount: number
          created_at?: string
          fixed_asset_id: string
          id?: string
          journal_entry_id?: string | null
          period_month: string
        }
        Update: {
          amount?: number
          created_at?: string
          fixed_asset_id?: string
          id?: string
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
          cost: number
          created_at: string
          depreciation_expense_account_id: string
          disposed_at: string | null
          id: string
          name: string
          purchased_date: string
          updated_at: string
          useful_life_months: number
        }
        Insert: {
          accum_depreciation_account_id: string
          asset_account_id: string
          cost: number
          created_at?: string
          depreciation_expense_account_id: string
          disposed_at?: string | null
          id?: string
          name: string
          purchased_date: string
          updated_at?: string
          useful_life_months: number
        }
        Update: {
          accum_depreciation_account_id?: string
          asset_account_id?: string
          cost?: number
          created_at?: string
          depreciation_expense_account_id?: string
          disposed_at?: string | null
          id?: string
          name?: string
          purchased_date?: string
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
            foreignKeyName: "fixed_assets_depreciation_expense_account_id_fkey"
            columns: ["depreciation_expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
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
          purchase_order_id: string | null
          quantity: number
          received_by: string
          received_by_email: string | null
          shipping_fee: number
          source: string
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
          purchase_order_id?: string | null
          quantity: number
          received_by: string
          received_by_email?: string | null
          shipping_fee?: number
          source?: string
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
          purchase_order_id?: string | null
          quantity?: number
          received_by?: string
          received_by_email?: string | null
          shipping_fee?: number
          source?: string
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
          id: string
          loyverse_modifier_option_id: string
          modifier_id: string
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          loyverse_modifier_option_id: string
          modifier_id: string
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          loyverse_modifier_option_id?: string
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
          loyverse_modifier_id: string
          name: string
          raw: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          loyverse_modifier_id: string
          name: string
          raw?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          loyverse_modifier_id?: string
          name?: string
          raw?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          item_name_snapshot: string | null
          line_discount: number
          line_note: string | null
          order_id: string
          quantity: number
          sku_snapshot: string | null
          unit_price: number
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_name_snapshot?: string | null
          line_discount?: number
          line_note?: string | null
          order_id: string
          quantity?: number
          sku_snapshot?: string | null
          unit_price?: number
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_name_snapshot?: string | null
          line_discount?: number
          line_note?: string | null
          order_id?: string
          quantity?: number
          sku_snapshot?: string | null
          unit_price?: number
          variant_id?: string
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
      order_shipments: {
        Row: {
          courier_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          id: string
          note: string | null
          order_id: string
          shipped_at: string | null
          shipping_cost: number | null
          shipping_fee_charged: number | null
          status: string | null
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          courier_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          id?: string
          note?: string | null
          order_id: string
          shipped_at?: string | null
          shipping_cost?: number | null
          shipping_fee_charged?: number | null
          status?: string | null
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          courier_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          id?: string
          note?: string | null
          order_id?: string
          shipped_at?: string | null
          shipping_cost?: number | null
          shipping_fee_charged?: number | null
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
      profiles: {
        Row: {
          birthday: string | null
          contact_number: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          birthday?: string | null
          contact_number?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          birthday?: string | null
          contact_number?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          discount_amount: number
          id: string
          item_name_snapshot: string | null
          line_total: number
          note: string | null
          purchase_order_id: string
          quantity_ordered: number
          quantity_received: number
          unit_cost: number
          variant_id: string
        }
        Insert: {
          created_at?: string
          discount_amount?: number
          id?: string
          item_name_snapshot?: string | null
          line_total?: number
          note?: string | null
          purchase_order_id: string
          quantity_ordered: number
          quantity_received?: number
          unit_cost?: number
          variant_id: string
        }
        Update: {
          created_at?: string
          discount_amount?: number
          id?: string
          item_name_snapshot?: string | null
          line_total?: number
          note?: string | null
          purchase_order_id?: string
          quantity_ordered?: number
          quantity_received?: number
          unit_cost?: number
          variant_id?: string
        }
        Relationships: [
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
          reference: string
          shipping_fee: number
          status: string
          store_id: string | null
          subtotal: number
          supplier_id: string
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
          reference: string
          shipping_fee?: number
          status?: string
          store_id?: string | null
          subtotal?: number
          supplier_id: string
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
          reference?: string
          shipping_fee?: number
          status?: string
          store_id?: string | null
          subtotal?: number
          supplier_id?: string
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
      stores: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          loyverse_store_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          loyverse_store_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          loyverse_store_id?: string | null
          name?: string
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
      adjust_order_items:
        | {
            Args: {
              p_customer_id?: string
              p_lines: Json
              p_note?: string
              p_order_id: string
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
        | {
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
      archive_item: { Args: { p_item_id: string }; Returns: undefined }
      confirm_order: {
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
      convert_quote_to_order: {
        Args: { p_quote_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          fulfillment_method: string | null
          id: string
          loyverse_receipt_id: string | null
          loyverse_receipt_number: string | null
          note: string | null
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
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_balance_sheet: {
        Args: { p_as_of?: string }
        Returns: {
          account_name: string
          account_number: number
          amount: number
          category: string
        }[]
      }
      get_income_statement: {
        Args: { p_end: string; p_start: string }
        Returns: {
          account_name: string
          account_number: number
          amount: number
          category: string
        }[]
      }
      get_trial_balance: {
        Args: { p_as_of?: string }
        Returns: {
          account_name: string
          account_number: number
          category: string
          credit_balance: number
          debit_balance: number
        }[]
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
      receive_purchase_order: {
        Args: { p_lines: Json; p_purchase_order_id: string }
        Returns: undefined
      }
      run_monthly_depreciation: {
        Args: { p_period: string }
        Returns: {
          amount: number
          created_at: string
          fixed_asset_id: string
          id: string
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
