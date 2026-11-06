"use server";

import { redirect } from "next/navigation";

import { LOGIN_PATH, requireOperator, revokeSession } from "@/lib/gestionale/server/auth";

export async function logoutAction(): Promise<void> {
  await requireOperator();
  await revokeSession();
  redirect(LOGIN_PATH);
}
