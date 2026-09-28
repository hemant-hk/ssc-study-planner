import { NextRequest } from "next/server";
import { isAdminBearer } from "./admin-password";

// Old-style admin auth: the only access control is the admin password, sent
// as "Authorization: Bearer <password>". No accounts, no sessions, no cookies.
export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  return isAdminBearer(request.headers.get("authorization"));
}