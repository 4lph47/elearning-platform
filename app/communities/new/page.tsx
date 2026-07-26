import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CommunityForm } from "@/components/community/CommunityForm";

export const dynamic = "force-dynamic";

export default async function NewCommunityPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/communities/new");

  return <CommunityForm />;
}
