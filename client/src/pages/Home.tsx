import { Button } from "@/components/ui/button";
import { ArrowRight, CalendarDays, ChevronRight, CircleAlert, ClipboardCheck, Droplets, House, MapPin, MoreHorizontal, ShieldCheck, Snowflake, Sparkles, Wrench, Zap } from "lucide-react";
import { useState } from "react";

const quickServices = [
  { label: "Electrical", icon: Zap, color: "bg-amber-50 text-amber-700" },
  { label: "Plumbing", icon: Droplets, color: "bg-sky-50 text-sky-700" },
  { label: "AC care", icon: Snowflake, color: "bg-teal-50 text-teal-700" },
  { label: "Appliances", icon: Wrench, color: "bg-violet-50 text-violet-700" },
];

export default function Home() {
  const [fixOpen, setFixOpen] = useState(false);
  const [issue, setIssue] = useState("");
  const [assessmentReady, setAssessmentReady] = useState(false);

  return (
    <main className="min-h-screen bg-[#f4f2ed] text-[#172b25]">
      <div className="mx-auto min-h-screen max-w-[520px] bg-[#fbfaf7] shadow-[0_0_48px_rgba(26,47,39,0.08)]">
        <header className="flex items-center justify-between px-5 pb-3 pt-6">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ce6957]">HomeOS India</p><h1 className="mt-1 text-[26px] font-extrabold tracking-[-0.04em]">Good morning, Sam</h1></div>
          <button className="grid h-10 w-10 place-items-center rounded-full border border-[#e7e1d8] bg-white text-sm font-bold shadow-sm" aria-label="Account">S</button>
        </header>
        <button className="mx-5 flex items-center gap-1 text-xs font-semibold text-[#597067]"><MapPin className="h-3.5 w-3.5 text-[#ce6957]" /> Kondapur, Hyderabad <ChevronRight className="h-3.5 w-3.5" /></button>

        <section className="relative mx-5 mt-5 overflow-hidden rounded-[25px] bg-[#164c3e] px-5 pb-5 pt-5 text-white shadow-[0_18px_30px_rgba(21,70,57,0.2)]">
          <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#397160] opacity-60" />
          <p className="relative text-[10px] font-bold uppercase tracking-[0.14em] text-[#c8dbd2]">Home care, simplified</p>
          <h2 className="relative mt-3 max-w-[230px] text-[27px] font-extrabold leading-[1.04] tracking-[-0.045em]">Something wrong at home?</h2>
          <p className="relative mt-2 max-w-[265px] text-sm leading-5 text-[#d8e7e0]">Describe the problem. We’ll guide the next right step.</p>
          <Button onClick={() => { setFixOpen(true); setAssessmentReady(false); }} className="relative mt-5 h-12 w-full justify-between rounded-2xl bg-[#fffdf8] px-4 text-sm font-bold text-[#174c3e] hover:bg-white">Tell us what's wrong <span className="grid h-7 w-7 place-items-center rounded-full bg-[#e5eee8]"><ArrowRight className="h-4 w-4" /></span></Button>
        </section>

        <section className="mx-5 mt-4 flex items-center rounded-[19px] border border-[#e7e1d8] bg-white p-3 shadow-sm"><div className="grid h-12 w-12 place-items-center rounded-full bg-[#e7f0e7] text-[#245847]"><span className="text-lg font-extrabold tracking-[-0.08em]">82</span><span className="-ml-0.5 mt-2 text-[9px] font-bold">/100</span></div><div className="ml-3 flex-1"><p className="text-sm font-extrabold">Home Health</p><p className="mt-0.5 text-[11px] text-[#718078]">One maintenance item is due this month.</p></div><ChevronRight className="h-5 w-5 text-[#99a39e]" /></section>

        <button className="mx-5 mt-3 w-[calc(100%-2.5rem)] rounded-[19px] bg-[#1e6350] p-3.5 text-left text-white shadow-[0_12px_22px_rgba(25,91,73,0.15)]"><div className="flex items-center justify-between"><span className="rounded-full bg-white/15 px-2 py-1 text-[9px] font-bold tracking-wide">REQUEST RECEIVED</span><span className="text-[10px] font-semibold text-[#d6e8df]">About 12 min</span></div><div className="mt-2.5 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><Snowflake className="h-4 w-4" /></span><span className="flex-1"><span className="block text-sm font-bold">AC cooling check</span><span className="mt-0.5 block text-[11px] text-[#d6e8df]">Ramesh Kumar · Tap to track your job</span></span><ChevronRight className="h-4 w-4" /></div></button>

        <section className="mt-6 px-5"><div className="flex items-center justify-between"><h2 className="text-base font-extrabold tracking-[-0.02em]">Quick services</h2><button className="text-[11px] font-bold text-[#ce6957]">View all</button></div><div className="mt-3 grid grid-cols-4 gap-2">{quickServices.map(({ label, icon: Icon, color }) => <button key={label} onClick={() => setFixOpen(true)} className="rounded-2xl border border-[#eee9e1] bg-white px-2 py-3 text-center shadow-sm transition hover:-translate-y-0.5"><span className={`mx-auto grid h-8 w-8 place-items-center rounded-xl ${color}`}><Icon className="h-4 w-4" /></span><span className="mt-2 block text-[10px] font-bold text-[#32473e]">{label}</span></button>)}</div></section>

        <section className="mt-6 px-5 pb-24"><h2 className="text-base font-extrabold tracking-[-0.02em]">Your home</h2><div className="mt-3 overflow-hidden rounded-[19px] border border-[#e7e1d8] bg-white shadow-sm"><button className="flex w-full items-center gap-3 border-b border-[#eee9e1] px-4 py-3.5 text-left"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#fff3df] text-[#c9872a]"><CalendarDays className="h-4 w-4" /></span><span className="flex-1"><span className="block text-xs font-bold">Maintenance due</span><span className="mt-0.5 block text-[10px] text-[#718078]">AC service is due this month</span></span><ChevronRight className="h-4 w-4 text-[#a2aaa5]" /></button><button className="flex w-full items-center gap-3 px-4 py-3.5 text-left"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#e8f0e8] text-[#2f745a]"><ShieldCheck className="h-4 w-4" /></span><span className="flex-1"><span className="block text-xs font-bold">Active warranties</span><span className="mt-0.5 block text-[10px] text-[#718078]">2 services are currently protected</span></span><ChevronRight className="h-4 w-4 text-[#a2aaa5]" /></button></div><div className="mt-4 flex gap-2 rounded-2xl bg-[#edf5ef] px-3 py-2.5 text-[10px] leading-4 text-[#356554]"><CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> For sparks, gas smells, or a major leak, use Emergency help and follow safety guidance first.</div></section>

        <nav className="fixed bottom-0 left-1/2 flex h-[72px] w-full max-w-[520px] -translate-x-1/2 items-center justify-around border-t border-[#ebe6de] bg-[#fffdf9]/95 px-6 backdrop-blur"><button className="flex flex-col items-center gap-1 text-[#ce6957]"><House className="h-5 w-5" /><span className="text-[9px] font-bold">Home</span></button><button className="flex flex-col items-center gap-1 text-[#7d8b84]"><ClipboardCheck className="h-5 w-5" /><span className="text-[9px] font-bold">Jobs</span></button><button className="flex flex-col items-center gap-1 text-[#7d8b84]"><ShieldCheck className="h-5 w-5" /><span className="text-[9px] font-bold">Passport</span></button><button className="flex flex-col items-center gap-1 text-[#7d8b84]"><MoreHorizontal className="h-5 w-5" /><span className="text-[9px] font-bold">Account</span></button></nav>
      </div>

      {fixOpen ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#152b23]/50 sm:items-center sm:p-5"><section className="w-full max-w-[520px] rounded-t-[28px] bg-[#fffdf9] p-5 shadow-2xl sm:rounded-[28px]"><div className="mx-auto h-1.5 w-12 rounded-full bg-[#ded8ce]" /><div className="mt-5 flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#ce6957]">Fix Anything</p><h2 className="mt-1 text-2xl font-extrabold tracking-[-0.04em]">What needs attention?</h2></div><button onClick={() => setFixOpen(false)} className="rounded-full bg-[#f1eee8] px-3 py-1.5 text-xs font-bold">Close</button></div>{!assessmentReady ? <><textarea value={issue} onChange={(event) => setIssue(event.target.value)} placeholder="For example: The AC runs, but it is not cooling the room." className="mt-5 h-28 w-full resize-none rounded-2xl border border-[#ded8ce] bg-white p-4 text-sm outline-none placeholder:text-[#a0aaa4] focus:border-[#2e715c] focus:ring-2 focus:ring-[#d5e8df]" /><button className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#d7cec2] bg-[#fcfaf5] py-3 text-xs font-bold text-[#5d6f66]"><Sparkles className="h-4 w-4 text-[#ce6957]" /> Add a photo for better guidance</button><Button disabled={issue.trim().length < 6} onClick={() => setAssessmentReady(true)} className="mt-4 h-12 w-full rounded-2xl bg-[#1d614e] text-sm font-bold hover:bg-[#174d3e]">Continue to guided assessment <ArrowRight className="ml-2 h-4 w-4" /></Button></> : <div className="mt-5 rounded-2xl bg-[#edf5ef] p-4"><div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#dcecdf] text-[#28614c]"><Sparkles className="h-4 w-4" /></span><div><p className="text-sm font-extrabold">We’ll help narrow it down.</p><p className="mt-1 text-xs leading-5 text-[#527164]">HomeOS asks a few focused questions, estimates a range, and matches qualified professionals. No work starts without your explicit quote approval.</p></div></div><Button onClick={() => setFixOpen(false)} className="mt-4 h-10 w-full rounded-xl bg-[#1d614e] text-xs font-bold">View assessment</Button></div>}</section></div> : null}
    </main>
  );
}
