import Link from "next/link";
import { ArrowDown, ArrowUpRight, Camera, Circle, Disc3, Sparkles } from "lucide-react";

const moments = [
  { src: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=85", alt: "Friends beneath a night sky", label: "01:18 AM · SOMEWHERE OUTSIDE" },
  { src: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=85", alt: "A crowded dance floor under red lights", label: "11:42 PM · NO PHONES OUT" },
  { src: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=85", alt: "A friend smiling in warm light", label: "12:06 AM · THE GOOD PART" },
];

export default function Home() {
  return (
    <main className="overflow-hidden">
      <section className="relative mx-auto min-h-[calc(100svh-68px)] max-w-[1440px] px-5 pb-16 pt-9 sm:px-10 lg:px-16 lg:pb-20 lg:pt-14">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_75%_43%,rgba(117,44,37,.17),transparent_41%)]" />
        <div className="grid min-h-[74svh] items-center gap-10 lg:grid-cols-[1.05fr_.95fr]">
          <div className="relative z-10 max-w-[700px]">
            <p className="eyebrow mb-7 flex items-center gap-3"><span className="h-px w-7 bg-[#a33a32]" />A little less scrolling. A little more living.</p>
            <h1 className="font-display text-[clamp(4.5rem,11.4vw,10.2rem)] leading-[.77] tracking-[-.075em] text-[#eee9de]">
              Keep<br /><span className="italic text-[#b54b40]">the night.</span>
            </h1>
            <p className="mt-8 max-w-[390px] text-[15px] leading-7 text-[#a6a095] sm:text-base">Pass around one camera. Put your phones away. See the night the way it happened — together, tomorrow.</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/rolls/new" className="button-primary">Start a roll <ArrowUpRight size={16} /></Link>
              <Link href="/dashboard" className="px-3 py-3 text-xs tracking-[.13em] text-[#b7b0a4] transition hover:text-white">EXPLORE THE DEMO <span aria-hidden>↗</span></Link>
            </div>
            <div className="mt-12 flex items-center gap-3 text-[11px] text-[#777168]"><span className="flex -space-x-2"><span className="h-7 w-7 rounded-full border-2 border-[#141311] bg-[url('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80')] bg-cover"/><span className="h-7 w-7 rounded-full border-2 border-[#141311] bg-[url('https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80')] bg-cover"/><span className="h-7 w-7 rounded-full border-2 border-[#141311] bg-[url('https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=80')] bg-cover"/></span><span>Made for the people who were there.</span></div>
          </div>
          <div className="relative mx-auto grid w-full max-w-[590px] grid-cols-[1fr_.74fr] items-center gap-3 sm:gap-5 lg:ml-auto">
            <div className="relative mt-12 rotate-[-3deg] border border-white/10 bg-[#211e19] p-2 pb-9 shadow-2xl sm:p-3 sm:pb-11">
              <div className="photo-frame aspect-[.82]"><img src={moments[0].src} alt={moments[0].alt} /></div>
              <span className="absolute bottom-3 left-3 font-mono text-[8px] tracking-[.15em] text-[#b9b2a6] sm:bottom-4 sm:left-4 sm:text-[9px]">{moments[0].label}</span>
              <div className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[#a33a32] shadow-xl sm:-right-5 sm:-top-5 sm:h-14 sm:w-14"><Camera size={19} strokeWidth={1.5} /></div>
            </div>
            <div className="relative -mt-10 space-y-3 sm:-mt-16 sm:space-y-5">
              <div className="relative rotate-[4deg] border border-white/10 bg-[#211e19] p-2 pb-8 shadow-2xl sm:p-3 sm:pb-10">
                <div className="photo-frame aspect-[1.05]"><img src={moments[1].src} alt={moments[1].alt} /></div>
                <span className="absolute bottom-2.5 left-3 font-mono text-[7px] tracking-[.12em] text-[#b9b2a6] sm:bottom-3 sm:left-4 sm:text-[9px]">{moments[1].label}</span>
              </div>
              <div className="relative -ml-8 w-[84%] rotate-[-5deg] border border-white/10 bg-[#211e19] p-2 pb-8 shadow-2xl sm:-ml-12 sm:p-3 sm:pb-10">
                <div className="photo-frame aspect-[1.16]"><img src={moments[2].src} alt={moments[2].alt} /></div>
                <span className="absolute bottom-2.5 left-3 font-mono text-[7px] tracking-[.12em] text-[#b9b2a6] sm:bottom-3 sm:left-4 sm:text-[9px]">{moments[2].label}</span>
              </div>
            </div>
            <div className="absolute -bottom-7 left-0 flex items-center gap-2 font-mono text-[9px] tracking-[.16em] text-[#716b61] sm:left-3"><Disc3 size={14} /> ROLL NO. 024 · 24 EXP</div>
            <div className="absolute -right-2 top-5 hidden -rotate-90 font-mono text-[9px] tracking-[.2em] text-[#6e675e] sm:block">EXPOSED TO LIFE</div>
          </div>
        </div>
        <div className="mt-16 flex items-center justify-between border-t border-white/10 pt-5 text-[10px] tracking-[.18em] text-[#625d55]">
          <span className="flex items-center gap-2"><Circle size={7} className="fill-[#a33a32] text-[#a33a32]" /> NOT LIVE. NOT PERFECT. JUST YOURS.</span>
          <a href="#how-it-works" className="hidden items-center gap-2 sm:flex">SCROLL TO GET IT <ArrowDown size={12}/></a>
          <span className="sm:hidden">EST. AFTER DARK</span>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-white/10 bg-[#191714] px-5 py-20 sm:px-10 lg:px-16 lg:py-28">
        <div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[.75fr_1.25fr]">
          <div><p className="eyebrow mb-5">THE WHOLE POINT</p><h2 className="font-display text-5xl leading-[.96] tracking-[-.05em] sm:text-6xl">Be here<br/><i>first.</i></h2><p className="mt-6 max-w-sm text-sm leading-6 text-[#a6a095]">The best parts of a night are usually the ones nobody stopped to post.</p></div>
          <div className="grid divide-y divide-white/10 border-y border-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[{ n:"01", title:"Make a roll", body:"Pick the night, set a photo limit, invite your people." }, { n:"02", title:"Pass it around", body:"Capture the blurry bits and the happy accidents." }, { n:"03", title:"Open it tomorrow", body:"When the roll ends, relive the night together." }].map((s) => <div key={s.n} className="py-6 sm:px-5 sm:py-2 lg:px-8"><span className="font-mono text-[10px] text-[#a34b42]">{s.n} / 03</span><h3 className="mt-5 font-display text-2xl">{s.title}</h3><p className="mt-3 text-sm leading-6 text-[#8e887d]">{s.body}</p></div>)}
          </div>
        </div>
        <div className="mx-auto mt-16 flex max-w-[1280px] flex-col justify-between gap-6 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
          <p className="flex items-center gap-2 text-[11px] text-[#777168]"><Sparkles size={14} className="text-[#a34b42]"/> This preview saves to this browser only.</p>
          <Link href="/rolls/new" className="button-secondary w-fit">Make your first roll <ArrowUpRight size={15}/></Link>
        </div>
      </section>
      <footer className="flex flex-col gap-2 px-5 py-7 text-[9px] tracking-[.15em] text-[#686258] sm:flex-row sm:justify-between sm:px-10 lg:px-16"><span>© AFTERHOURS CAMERA CLUB</span><span>A LITTLE GRAIN. A LOT OF FEELING.</span></footer>
    </main>
  );
}
