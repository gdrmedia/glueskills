"use client";

import { useState } from "react";
import { JobNameInput } from "@/components/banner-resizer/job-name-input";
import { SizePicker } from "@/components/banner-resizer/size-picker";
import { OptionsForm } from "@/components/banner-resizer/options-form";
import { CodeDisplay } from "@/components/banner-resizer/code-display";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { jobNameSchema, bannerJobConfigSchema, type BannerJobConfig, type BannerJobTarget } from "@/lib/banner-jobs/job-config";
import { LayoutPanelLeft } from "lucide-react";

export default function BannerResizerPage() {
  const [name, setName] = useState("");
  const [targets, setTargets] = useState<BannerJobTarget[]>([]);
  const [options, setOptions] = useState<BannerJobConfig["options"]>({
    placeOnNewPage: true,
    namingPattern: "size-job",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ code: string; expiresAt: string } | null>(null);

  async function handleSubmit() {
    const nameResult = jobNameSchema.safeParse(name);
    if (!nameResult.success) {
      toast.error("Please enter a job name");
      return;
    }
    const configResult = bannerJobConfigSchema.safeParse({ version: 1, targets, options });
    if (!configResult.success) {
      toast.error(targets.length === 0 ? "Pick at least one size" : "Invalid configuration");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/banner-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameResult.data, config: configResult.data }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error || "Failed to create job");
        return;
      }
      const data = await res.json();
      setResult({ code: data.code, expiresAt: data.expiresAt });
    } catch (err) {
      console.error(err);
      toast.error("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  // Post-submit view
  if (result) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight">Job created</h1>
          <p className="mt-1.5 text-muted-foreground">
            Take this code to the GlueSkills Banner Resizer plugin in Figma.
          </p>
        </div>
        <CodeDisplay code={result.code} expiresAt={result.expiresAt} />
        <div>
          <Button variant="outline" onClick={() => { setResult(null); setName(""); setTargets([]); }}>
            Create another job
          </Button>
        </div>
      </div>
    );
  }

  // Wizard form view
  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/12 text-purple-600">
          <LayoutPanelLeft className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight">Banner Resizer</h1>
          <p className="mt-1.5 text-muted-foreground">
            Generate IAB banner size variants from your Figma source frames. Configure the job here, then run the GlueSkills Banner Resizer plugin in Figma to materialize the new frames.
          </p>
        </div>
      </div>

      <section>
        <JobNameInput value={name} onChange={setName} />
      </section>

      <section>
        <h2 className="mb-4 font-headline text-lg font-bold tracking-tight">Target sizes</h2>
        <SizePicker selected={targets} onChange={setTargets} />
      </section>

      <section>
        <h2 className="mb-4 font-headline text-lg font-bold tracking-tight">Generation options</h2>
        <OptionsForm value={options} onChange={setOptions} />
      </section>

      <div className="flex justify-end">
        <Button size="lg" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Creating..." : "Generate code"}
        </Button>
      </div>
    </div>
  );
}
