export default function Home() {
  return (
    <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="rounded-3xl bg-slate-900 px-8 py-10 text-white shadow-lg">
          <p className="text-sm uppercase tracking-[0.25em] text-blue-200">Overview</p>
          <h1 className="mt-3 text-4xl font-semibold">Build a cleaner path from ideas to progress.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
            The app shell is now split more clearly: layout owns the frame, page owns the content,
            and chat manages its socket behavior through a dedicated hook.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            { label: "Structure", value: "Typed feature folders" },
            { label: "Chat", value: "Socket logic extracted" },
            { label: "UI", value: "Reusable shell layout" },
          ].map((item) => (
            <article
              key={item.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm text-slate-500">{item.label}</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{item.value}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
