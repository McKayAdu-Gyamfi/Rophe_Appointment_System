export function ComingSoon({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden
          >
            <path d="M12 6v6l4 2" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </span>
        <h1 className="mt-5 text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
        <p className="mt-6 inline-block rounded-full bg-slate-100 px-4 py-1.5 text-sm font-medium text-slate-500">
          Coming soon
        </p>
      </div>
    </div>
  );
}
