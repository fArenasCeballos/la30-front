type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type FnArgs = { p_order_id: string; p_status: string };
type GenericArgs = Record<string, unknown>;

const test1: FnArgs extends GenericArgs ? true : false = true;

const test2: { p_locator: string; p_items: Json; p_notes: string | null } extends GenericArgs ? true : false = true;

