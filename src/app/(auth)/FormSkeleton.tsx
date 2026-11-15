export function FormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div aria-hidden="true" className="flex animate-pulse flex-col gap-4">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="h-4 w-20 rounded bg-bg-tertiary" />
          <div className="h-11 rounded-md bg-bg-tertiary" />
        </div>
      ))}
      <div className="mt-2 h-11 rounded-md bg-bg-tertiary" />
    </div>
  );
}
