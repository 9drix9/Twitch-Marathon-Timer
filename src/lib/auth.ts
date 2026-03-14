import { NextRequest } from "next/server";
import { redis, keys } from "./db";

export async function verifyAdmin(id: string, req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const secret = authHeader.slice(7);
  if (!secret) {
    return false;
  }

  const meta = await redis().get(keys(id).meta) as { admin_secret?: string } | null;
  if (!meta || !meta.admin_secret) {
    return false;
  }

  return meta.admin_secret === secret;
}
