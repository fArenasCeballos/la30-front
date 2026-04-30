import { supabase } from "./src/lib/supabase";
import type { Database } from "./src/types/database.types";

type Fns = Database["public"]["Functions"];
type UpdateStatusFn = Fns["update_order_status"];
type UpdateStatusArgs = UpdateStatusFn["Args"];

const args: UpdateStatusArgs = { p_order_id: "1", p_status: "ok" };

async function test() {
  await supabase.rpc("update_order_status", args);
}
