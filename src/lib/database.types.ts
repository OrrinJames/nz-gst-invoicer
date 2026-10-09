/**
 * Database types for the Supabase client.
 *
 * Mirrors supabase/migrations. Regenerate after schema changes with:
 *   npx supabase gen types typescript --local > src/lib/database.types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export type TaxModeColumn = "exclusive" | "inclusive";

export interface Database {
  public: {
    Tables: {
      business_profiles: {
        Row: {
          owner_id: string;
          business_name: string;
          gst_number: string | null;
          email: string | null;
          address: string | null;
          bank_account: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          owner_id?: string;
          business_name: string;
          gst_number?: string | null;
          email?: string | null;
          address?: string | null;
          bank_account?: string | null;
        };
        Update: {
          business_name?: string;
          gst_number?: string | null;
          email?: string | null;
          address?: string | null;
          bank_account?: string | null;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          email: string | null;
          address: string | null;
          gst_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          name: string;
          email?: string | null;
          address?: string | null;
          gst_number?: string | null;
        };
        Update: {
          name?: string;
          email?: string | null;
          address?: string | null;
          gst_number?: string | null;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          owner_id: string;
          client_id: string;
          invoice_number: string;
          status: InvoiceStatus;
          tax_mode: TaxModeColumn;
          issue_date: string;
          due_date: string;
          notes: string | null;
          subtotal_cents: number;
          gst_cents: number;
          total_cents: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          client_id: string;
          invoice_number: string;
          status?: InvoiceStatus;
          tax_mode: TaxModeColumn;
          issue_date: string;
          due_date: string;
          notes?: string | null;
          subtotal_cents: number;
          gst_cents: number;
          total_cents: number;
        };
        Update: {
          status?: InvoiceStatus;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          position: number;
          description: string;
          quantity: number;
          unit_price_cents: number;
          amount_cents: number;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          position: number;
          description: string;
          quantity: number;
          unit_price_cents: number;
          amount_cents: number;
        };
        Update: {
          description?: string;
          quantity?: number;
          unit_price_cents?: number;
          amount_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_invoice: {
        Args: {
          p_client_id: string;
          p_tax_mode: TaxModeColumn;
          p_issue_date: string;
          p_due_date: string;
          p_notes: string | null;
          p_subtotal_cents: number;
          p_gst_cents: number;
          p_total_cents: number;
          p_items: Json;
        };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

type PublicTables = Database["public"]["Tables"];
export type Tables<T extends keyof PublicTables> = PublicTables[T]["Row"];
