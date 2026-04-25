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
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          value?: Json
        }
        Relationships: []
      }
      attendance: {
        Row: {
          academic_year: string
          created_at: string
          date: string
          id: string
          status: string
          student_id: string
        }
        Insert: {
          academic_year?: string
          created_at?: string
          date?: string
          id?: string
          status?: string
          student_id: string
        }
        Update: {
          academic_year?: string
          created_at?: string
          date?: string
          id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      lectures: {
        Row: {
          academic_year: string
          batch: string
          created_at: string
          date: string
          id: string
          subject: string
          teacher_id: string
        }
        Insert: {
          academic_year?: string
          batch?: string
          created_at?: string
          date?: string
          id?: string
          subject: string
          teacher_id: string
        }
        Update: {
          academic_year?: string
          batch?: string
          created_at?: string
          date?: string
          id?: string
          subject?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lectures_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          academic_year: string
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          payment_mode: string
          student_id: string
        }
        Insert: {
          academic_year?: string
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_mode?: string
          student_id: string
        }
        Update: {
          academic_year?: string
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_mode?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          academic_year: string
          admission_date: string
          batch: string
          board: string
          class: string
          created_at: string
          discount: number
          fee_due_day: number
          id: string
          lecture_days: string[]
          medium: string
          mobile: string
          name: string
          status: string
          subjects: string[]
          total_fees: number
        }
        Insert: {
          academic_year?: string
          admission_date?: string
          batch?: string
          board?: string
          class: string
          created_at?: string
          discount?: number
          fee_due_day?: number
          id?: string
          lecture_days?: string[]
          medium: string
          mobile: string
          name: string
          status?: string
          subjects?: string[]
          total_fees?: number
        }
        Update: {
          academic_year?: string
          admission_date?: string
          batch?: string
          board?: string
          class?: string
          created_at?: string
          discount?: number
          fee_due_day?: number
          id?: string
          lecture_days?: string[]
          medium?: string
          mobile?: string
          name?: string
          status?: string
          subjects?: string[]
          total_fees?: number
        }
        Relationships: []
      }
      teacher_attendance: {
        Row: {
          academic_year: string
          created_at: string
          date: string
          id: string
          status: string
          teacher_id: string
        }
        Insert: {
          academic_year?: string
          created_at?: string
          date?: string
          id?: string
          status?: string
          teacher_id: string
        }
        Update: {
          academic_year?: string
          created_at?: string
          date?: string
          id?: string
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_classes: {
        Row: {
          academic_year: string
          batch: string
          class: string
          created_at: string
          id: string
          teacher_id: string
        }
        Insert: {
          academic_year?: string
          batch: string
          class: string
          created_at?: string
          id?: string
          teacher_id: string
        }
        Update: {
          academic_year?: string
          batch?: string
          class?: string
          created_at?: string
          id?: string
          teacher_id?: string
        }
        Relationships: []
      }
      teachers: {
        Row: {
          created_at: string
          fixed_salary: number
          id: string
          name: string
          payment_type: string
          per_lecture_fee: number
          subject: string
        }
        Insert: {
          created_at?: string
          fixed_salary?: number
          id?: string
          name: string
          payment_type?: string
          per_lecture_fee?: number
          subject: string
        }
        Update: {
          created_at?: string
          fixed_salary?: number
          id?: string
          name?: string
          payment_type?: string
          per_lecture_fee?: number
          subject?: string
        }
        Relationships: []
      }
      test_results: {
        Row: {
          created_at: string
          id: string
          marks_obtained: number
          remarks: string | null
          student_id: string
          test_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          marks_obtained?: number
          remarks?: string | null
          student_id: string
          test_id: string
        }
        Update: {
          created_at?: string
          id?: string
          marks_obtained?: number
          remarks?: string | null
          student_id?: string
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_results_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          academic_year: string
          created_at: string
          id: string
          max_marks: number
          name: string
          standard: string
          subject: string
          test_date: string
        }
        Insert: {
          academic_year?: string
          created_at?: string
          id?: string
          max_marks?: number
          name: string
          standard: string
          subject: string
          test_date?: string
        }
        Update: {
          academic_year?: string
          created_at?: string
          id?: string
          max_marks?: number
          name?: string
          standard?: string
          subject?: string
          test_date?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          teacher_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          teacher_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          teacher_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_logs: {
        Row: {
          id: string
          message: string
          sent_at: string
          student_id: string
          type: string
        }
        Insert: {
          id?: string
          message: string
          sent_at?: string
          student_id: string
          type?: string
        }
        Update: {
          id?: string
          message?: string
          sent_at?: string
          student_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      students_safe: {
        Row: {
          academic_year: string | null
          admission_date: string | null
          batch: string | null
          board: string | null
          class: string | null
          created_at: string | null
          discount: number | null
          fee_due_day: number | null
          id: string | null
          lecture_days: string[] | null
          medium: string | null
          name: string | null
          status: string | null
          subjects: string[] | null
          total_fees: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_user_teacher_id: { Args: never; Returns: string }
      current_user_teacher_subject: { Args: never; Returns: string }
      get_students_safe: {
        Args: never
        Returns: {
          academic_year: string
          admission_date: string
          batch: string
          board: string
          class: string
          created_at: string
          discount: number
          fee_due_day: number
          id: string
          lecture_days: string[]
          medium: string
          name: string
          status: string
          subjects: string[]
          total_fees: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          _action: string
          _details?: Json
          _entity: string
          _entity_id?: string
        }
        Returns: string
      }
      log_audit_event_anon: {
        Args: {
          _action: string
          _attempted_email?: string
          _details?: Json
          _entity: string
          _entity_id?: string
        }
        Returns: string
      }
      teacher_can_mark_student: {
        Args: { _student_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "teacher"
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
      app_role: ["admin", "teacher"],
    },
  },
} as const
