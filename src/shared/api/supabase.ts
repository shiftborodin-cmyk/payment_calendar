import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type AppExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const extra = Constants.expoConfig?.extra as AppExtra | undefined;

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || extra?.supabaseUrl || "";

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra?.supabaseAnonKey || "";

const isWebServer = typeof window === "undefined";

export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? "Supabase не настроен: проверьте EXPO_PUBLIC_SUPABASE_URL и EXPO_PUBLIC_SUPABASE_ANON_KEY в .env и перезапустите Expo с очисткой кеша."
    : null;

export const supabase: SupabaseClient | null = supabaseConfigError
  || isWebServer
  ? null
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    });

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error(supabaseConfigError ?? "Supabase недоступен в этом окружении.");
  }

  return supabase;
}
