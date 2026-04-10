import { supabase } from "./client";

export type CommandRow = {
  name: string;
  description: string;
  usage: string | null;
  is_active: boolean;
};

export async function getActiveCommands(): Promise<CommandRow[]> {
  const { data, error } = await supabase
    .from("commands")
    .select("name, description, usage, is_active")
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("commands select error:", error.message);
    return [];
  }
  return data ?? [];
}
