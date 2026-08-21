import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Activity, ArrowUpRight, CircleAlert, MapPinned, ShieldCheck, UsersRound } from "lucide-react";

const statusLabels: Record<string, string> = {
  submitted: "New request",
  matched: "Matches found",
  assigned: "Assigned",
};

function MetricCard({ label, value, detail, icon: Icon, tone = "text-emerald-700 bg-emerald-50" }: { label: string; value: number; detail: string; icon: typeof Activity; tone?: string }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OpsDashboard() {
  const overview = trpc.homeos.operations.overview.useQuery(undefined, { retry: false });
  const dispatch = trpc.homeos.operations.dispatchQueue.useQuery(undefined, { retry: false });
  const summary = overview.data;
  const hasAccessError = overview.error?.data?.code === "FORBIDDEN" || dispatch.error?.data?.code === "FORBIDDEN";

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-7xl space-y-7">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Live operations</div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Dispatch command centre</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Monitor pilot demand, controlled dispatch, technician supply, and active work from one protected operations view.</p>
          </div>
          <Badge variant="outline" className="w-fit gap-1.5 border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800"><Activity className="h-3.5 w-3.5" /> Hyderabad pilot</Badge>
        </section>

        {hasAccessError ? <Card className="border-amber-200 bg-amber-50 shadow-none"><CardContent className="flex gap-3 p-4"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><p className="font-semibold text-amber-950">Operations access is restricted</p><p className="mt-1 text-sm leading-5 text-amber-900">Sign in with an administrator account to view live HomeOS data. The dashboard does not expose operational records to standard customer or technician accounts.</p></div></CardContent></Card> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {overview.isLoading ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-xl" />) : <>
            <MetricCard label="Active jobs" value={summary?.activeJobs ?? 0} detail="In travel, diagnosis, quote, or service" icon={Activity} />
            <MetricCard label="Needs dispatch" value={summary?.pendingDispatch ?? 0} detail="Submitted, matched, or assigned requests" icon={MapPinned} tone="text-orange-700 bg-orange-50" />
            <MetricCard label="Verified supply" value={summary?.verifiedTechnicians ?? 0} detail="Technicians cleared for the platform" icon={ShieldCheck} tone="text-sky-700 bg-sky-50" />
            <MetricCard label="Available now" value={summary?.availableTechnicians ?? 0} detail="Verified technicians ready for offers" icon={UsersRound} tone="text-violet-700 bg-violet-50" />
          </>}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.55fr_0.85fr]">
          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b border-border/70 px-5 py-4"><div><h2 className="font-semibold text-foreground">Dispatch queue</h2><p className="mt-1 text-xs text-muted-foreground">Controlled rounds should target the best qualified technicians before expanding.</p></div><Badge variant="secondary">{dispatch.data?.length ?? 0} open</Badge></div>
              <div className="divide-y divide-border/70">
                {dispatch.isLoading ? <div className="space-y-3 p-5"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : null}
                {!dispatch.isLoading && !dispatch.data?.length ? <div className="px-5 py-12 text-center"><MapPinned className="mx-auto h-7 w-7 text-muted-foreground/60" /><p className="mt-3 text-sm font-medium text-foreground">No dispatch exceptions</p><p className="mt-1 text-xs text-muted-foreground">New requests will appear here when they need matching or operator attention.</p></div> : null}
                {dispatch.data?.map((request) => <div key={request.id} className="flex items-center gap-4 px-5 py-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><MapPinned className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{request.category}</p><p className="truncate text-xs text-muted-foreground">{request.publicId} · {request.urgency} urgency</p></div><Badge variant="outline">{statusLabels[request.status] ?? request.status}</Badge><ArrowUpRight className="h-4 w-4 text-muted-foreground" /></div>)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-[linear-gradient(160deg,#173d34_0%,#255846_100%)] text-white shadow-sm">
            <CardContent className="flex h-full min-h-[290px] flex-col p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><ShieldCheck className="h-5 w-5" /></div>
              <h2 className="mt-6 text-xl font-semibold tracking-tight">Trust controls are part of dispatch.</h2>
              <p className="mt-3 text-sm leading-6 text-emerald-50/80">Every workflow is designed to keep the customer in control: qualified matching, itemised quotes, explicit approval, OTP-gated completion, a digital invoice, and a 30-day warranty record.</p>
              <div className="mt-auto rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-xs font-medium text-emerald-50">Live counts are read from protected HomeOS platform records.</div>
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
