import { BrandForm } from "@/components/brands/brand-form";

export default function NewBrandPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-extrabold tracking-tight">New brand</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a brand pack. You can edit everything after saving.
        </p>
      </div>
      <BrandForm mode="create" />
    </div>
  );
}
