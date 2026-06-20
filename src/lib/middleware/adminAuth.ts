import { getAuthUser } from "../auth";

export async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  if (user.role !== "admin") {
    throw new Error("Forbidden: Admin access required");
  }
  return user;
}
