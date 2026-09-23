import { Construction } from "lucide-react";

export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 py-24 text-center">
      <Construction className="h-8 w-8 text-muted-foreground" />
      <h2 className="font-serif text-xl font-semibold text-foreground">
        {title}
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}