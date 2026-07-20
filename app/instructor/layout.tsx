import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/instructor");
  if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") redirect("/dashboard");

  return <>{children}</>;
}
