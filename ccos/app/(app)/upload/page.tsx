import { forbidden } from "next/navigation";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/authz";
import { Crumbs, PageHeader } from "@/components/ui";
import { UploadForm } from "./form";

export default async function UploadPage() {
  const user = await requireUser();
  if (!user.live || !can(user, "upload_data")) forbidden();
  return (
    <>
      <Crumbs items={[{ label: "Home", href: "/" }, { label: "Upload data" }]} />
      <PageHeader title="Upload data" sub="Drop in the Rent Manager weekly packet for properties that are not connected live. You see a preview first, and nothing is saved until you press Save." />
      <UploadForm />
    </>
  );
}
