import { supabase } from '../supabase';

export type DeleteAccountResult = { ok: true } | { ok: false; message: string };

/** Calls the delete-account Edge Function. Requires an active session —
 * the function derives the account to delete from the caller's own JWT,
 * never from client input, so it can only ever delete the caller's own
 * account. */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const { data, error } = await supabase.functions.invoke<DeleteAccountResult>('delete-account');
  if (error || !data) {
    return { ok: false, message: "Couldn't delete your account. Try again." };
  }
  return data;
}
