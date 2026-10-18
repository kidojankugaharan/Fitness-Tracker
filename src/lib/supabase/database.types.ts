// Hand-written to mirror supabase/migrations. Once the Supabase CLI is linked, replace this file
// with generated types via `npm run db:types` (the export names below match the generated ones).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Relationship = {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

type Table<Row, Required extends keyof Row = never, Relationships extends Relationship[] = []> = {
  Row: Row
  Insert: Partial<Row> & Pick<Row, Required>
  Update: Partial<Row>
  Relationships: Relationships
}

type ForeignKey<Name extends string, Column extends string, Referenced extends string> = {
  foreignKeyName: Name
  columns: [Column]
  isOneToOne: false
  referencedRelation: Referenced
  referencedColumns: ['id']
}

export type UnitSystem = 'kg' | 'lb'
export type EnergyUnit = 'kcal' | 'kJ'
export type FoodSource = 'off' | 'custom' | 'recipe'
export type ExerciseCategory = 'Chest' | 'Back' | 'Shoulders' | 'Legs' | 'Arms' | 'Core' | 'Cardio' | 'Other'
export type ExerciseType = 'weight_reps' | 'reps' | 'time' | 'distance' | 'weight_time'

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        {
          user_id: string
          display_name: string | null
          units: UnitSystem
          energy_unit: EnergyUnit
          goal_kcal: number
          goal_protein_g: number
          goal_carbs_g: number
          goal_fat_g: number
          goal_fiber_g: number | null
          meal_names: string[]
          week_start: number
          rest_timer_default_sec: number
          created_at: string
          updated_at: string
        },
        'user_id'
      >
      body_weights: Table<
        { id: string; user_id: string; date: string; weight_kg: number; created_at: string },
        'date' | 'weight_kg'
      >
      foods: Table<
        {
          id: string
          user_id: string | null
          source: FoodSource
          off_code: string | null
          name: string
          brand: string | null
          kcal_100g: number
          protein_100g: number | null
          carbs_100g: number | null
          fat_100g: number | null
          fiber_100g: number | null
          sugar_100g: number | null
          sat_fat_100g: number | null
          sodium_mg_100g: number | null
          servings: Json
          created_at: string
          updated_at: string
        },
        'source' | 'name' | 'kcal_100g'
      >
      user_foods: Table<
        {
          user_id: string
          food_id: string
          is_favorite: boolean
          use_count: number
          last_used_at: string | null
        },
        'food_id',
        [ForeignKey<'user_foods_food_id_fkey', 'food_id', 'foods'>]
      >
      food_entries: Table<
        {
          id: string
          user_id: string
          date: string
          meal: string
          food_id: string | null
          food_snapshot: Json
          grams: number
          serving_label: string | null
          created_at: string
        },
        'date' | 'meal' | 'food_snapshot' | 'grams',
        [ForeignKey<'food_entries_food_id_fkey', 'food_id', 'foods'>]
      >
      recipes: Table<
        { id: string; user_id: string; name: string; servings: number; created_at: string },
        'name'
      >
      recipe_items: Table<
        { recipe_id: string; food_id: string; position: number; grams: number },
        'recipe_id' | 'food_id' | 'grams'
      >
      exercises: Table<
        {
          id: string
          user_id: string | null
          name: string
          category: ExerciseCategory
          type: ExerciseType
          equipment: string | null
          notes: string | null
          archived: boolean
          created_at: string
        },
        'name' | 'category'
      >
      routines: Table<{ id: string; user_id: string; name: string; created_at: string }, 'name'>
      routine_items: Table<
        {
          id: string
          routine_id: string
          exercise_id: string
          position: number
          target_sets: number
          target_reps: number | null
        },
        'routine_id' | 'exercise_id'
      >
      workouts: Table<
        {
          id: string
          user_id: string
          date: string
          started_at: string
          ended_at: string | null
          notes: string | null
          routine_id: string | null
          created_at: string
        },
        'date'
      >
      workout_sets: Table<
        {
          id: string
          user_id: string
          workout_id: string
          exercise_id: string
          exercise_order: number
          set_index: number
          weight_kg: number | null
          reps: number | null
          duration_sec: number | null
          distance_m: number | null
          rpe: number | null
          is_warmup: boolean
          notes: string | null
          completed_at: string | null
          created_at: string
        },
        'workout_id' | 'exercise_id',
        [
          ForeignKey<'workout_sets_workout_id_fkey', 'workout_id', 'workouts'>,
          ForeignKey<'workout_sets_exercise_id_fkey', 'exercise_id', 'exercises'>,
        ]
      >
    }
    Views: { [_ in never]: never }
    Functions: {
      cache_off_food: {
        Args: {
          p_off_code: string
          p_name: string
          p_brand: string | null
          p_kcal_100g: number
          p_protein_100g: number | null
          p_carbs_100g: number | null
          p_fat_100g: number | null
          p_fiber_100g: number | null
          p_sugar_100g: number | null
          p_sat_fat_100g: number | null
          p_sodium_mg_100g: number | null
          p_servings: Json
        }
        Returns: string
      }
      record_food_use: { Args: { p_food_id: string }; Returns: undefined }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicTables = Database['public']['Tables']
export type Tables<T extends keyof PublicTables> = PublicTables[T]['Row']
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]['Insert']
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]['Update']
