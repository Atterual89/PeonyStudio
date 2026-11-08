import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/gestionale/server/auth";

// Compatibility redirect: email payments are now reviewed in the existing soci screen.
export default async function LegacyPaymentEmailPage(){
 await requireAdmin();
 redirect("/gestione/altro/soci?quote=1#quote-email");
}
