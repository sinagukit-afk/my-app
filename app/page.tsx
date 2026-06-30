import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-1 items-center bg-stone-50 px-6 py-12">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <p className="text-sm font-medium uppercase tracking-wide text-stone-500">
            Sinag POS
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">
            Your point-of-sale dashboard, ready when your shift starts.
          </h1>
          <p className="mt-5 text-base leading-7 text-stone-600 sm:text-lg">
            Sign in to review store activity, manage daily operations, and keep
            your team moving from one focused workspace.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-md bg-stone-950 px-5 text-sm font-medium text-white transition-colors hover:bg-stone-800"
            >
              Sign in
            </Link>
          </div>
        </div>

        <div className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-100 pb-4">
            <div>
              <p className="text-sm font-medium text-stone-950">Today</p>
              <p className="text-xs text-stone-500">Dashboard preview</p>
            </div>
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
              Online
            </span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-md border border-stone-100 p-4">
              <p className="text-xs text-stone-500">Sales</p>
              <p className="mt-2 text-2xl font-semibold text-stone-950">--</p>
            </div>
            <div className="rounded-md border border-stone-100 p-4">
              <p className="text-xs text-stone-500">Orders</p>
              <p className="mt-2 text-2xl font-semibold text-stone-950">--</p>
            </div>
            <div className="col-span-2 rounded-md border border-stone-100 p-4">
              <p className="text-xs text-stone-500">Next step</p>
              <p className="mt-2 text-sm text-stone-700">
                Connect live POS metrics after signing in.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
