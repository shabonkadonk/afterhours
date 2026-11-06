import Link from "next/link";
import { ArrowDown, ArrowUpRight, Camera, Circle, Disc3, Download, Sparkles } from "lucide-react";
import { InstallGuideLink } from "@/components/install-guide-link";
import { HomeExperience } from "@/components/home-experience";

const moments = [
  { src: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=650&q=78", alt: "Friends beneath a night sky", label: "01:18 AM · SOMEWHERE OUTSIDE" },
  { src: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=500&q=78", alt: "A crowded dance floor under red lights", label: "11:42 PM · NO PHONES OUT" },
  { src: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=440&q=78", alt: "A friend smiling in warm light", label: "12:06 AM · THE GOOD PART" },
];

function BrowserHome() {
  return (
    <main className="overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-0">
      <section className="relative mx-auto max-w-[1440px] px-4 pb-8 pt-6 sm:px-10 sm:pb-16 sm:pt-9 lg:px-16 lg:pb-20 lg:pt-14">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_75%_43%,rgba(117,44,37,.17),transparent_41%)]" />
        <div className="grid items-center gap-8 lg:min-h-[74svh] lg:gap-10 lg:grid-cols-[1.05fr_.95fr]">
          <div className="relative z-10 max-w-[700px]">
            <p className="eyebrow rise-in mb-5 flex items-center gap-3 sm:mb-7"><span className="h-px w-7 bg-[#a33a32]" />A shared camera roll for nights out</p>
            <h1 className="font-display rise-in rise-in--1 text-[clamp(4.5rem,10vw,8.5rem)] leading-[.82] tracking-[-.065em] text-[#eee9de]">
              Keep<br /><span className="italic text-[#b54b40]">the night.</span>
            </h1>
            <p className="rise-in rise-in--2 mt-6 max-w-[430px] text-[15px] leading-7 text-[#a6a095] sm:mt-8 sm:text-base">Invite your people to add photos through the night. Open the roll together tomorrow and see it from every angle.</p>
            <div className="rise-in rise-in--3 mt-6 flex flex-col items-stretch gap-1 sm:mt-8 sm:flex-row sm:items-center sm:gap-4">
              <Link href="/rolls/new" className="button-primary min-h-[54px] w-full sm:w-fit">Create a roll <ArrowUpRight size={16} /></Link>
              <Link href="/dashboard" className="px-3 py-3 text-center text-sm text-[#b7b0a4] transition hover:text-white sm:text-left">Explore your rolls <span aria-hidden>↗</span></Link>
            </div>
            <InstallGuideLink className="rise-in rise-in--4 mt-3 inline-flex min-h-11 items-center gap-2 px-3 text-sm text-[#aaa396] transition hover:text-white">
              <Download size={15} className="text-[#c55448]" /> Install Afterhours on your phone <ArrowUpRight size={13} />
            </InstallGuideLink>
            <div className="rise-in rise-in--4 mt-6 flex items-center gap-2 text-xs text-[#898378] sm:mt-12"><Disc3 size={15} className="text-[#b54b40]"/>One private roll, shared with your crew.</div>
          </div>
          <div className="relative mx-auto grid w-full max-w-[520px] grid-cols-[1fr_.74fr] items-center gap-2 sm:gap-5 lg:ml-auto">
            <div className="home-print rise-in rise-in--2 relative mt-7 rotate-[-3deg] border border-white/10 bg-[#211e19] p-1.5 pb-8 shadow-2xl sm:mt-12 sm:p-3 sm:pb-11">
              <div className="photo-frame aspect-[.82]"><img src={moments[0].src} alt={moments[0].alt} loading="eager" fetchPriority="high" decoding="async" sizes="(max-width: 640px) 52vw, 300px" /></div>
              <span className="absolute bottom-2.5 left-2.5 font-mono text-[7px] tracking-[.11em] text-[#b9b2a6] sm:bottom-4 sm:left-4 sm:text-[9px]">{moments[0].label}</span>
              <div className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[#a33a32] shadow-xl sm:-right-5 sm:-top-5 sm:h-14 sm:w-14"><Camera size={19} strokeWidth={1.5} /></div>
            </div>
            <div className="relative -mt-8 space-y-2.5 sm:-mt-16 sm:space-y-5">
              <div className="home-print rise-in rise-in--3 relative rotate-[4deg] border border-white/10 bg-[#211e19] p-1.5 pb-7 shadow-2xl sm:p-3 sm:pb-10">
                <div className="photo-frame aspect-[1.05]"><img src={moments[1].src} alt={moments[1].alt} loading="lazy" decoding="async" sizes="(max-width: 640px) 38vw, 220px" /></div>
                <span className="absolute bottom-2 left-2 font-mono text-[6px] tracking-[.08em] text-[#b9b2a6] sm:bottom-3 sm:left-4 sm:text-[9px]">{moments[1].label}</span>
              </div>
              <div className="home-print rise-in rise-in--4 relative -ml-6 w-[84%] rotate-[-5deg] border border-white/10 bg-[#211e19] p-1.5 pb-7 shadow-2xl sm:-ml-12 sm:p-3 sm:pb-10">
                <div className="photo-frame aspect-[1.16]"><img src={moments[2].src} alt={moments[2].alt} loading="lazy" decoding="async" sizes="(max-width: 640px) 34vw, 200px" /></div>
                <span className="absolute bottom-2 left-2 font-mono text-[6px] tracking-[.08em] text-[#b9b2a6] sm:bottom-3 sm:left-4 sm:text-[9px]">{moments[2].label}</span>
              </div>
            </div>
            <div className="absolute -bottom-6 left-0 flex items-center gap-1.5 font-mono text-[8px] tracking-[.1em] text-[#716b61] sm:bottom-[-1.75rem] sm:left-3 sm:gap-2 sm:text-[9px] sm:tracking-[.16em]"><Disc3 size={14} /> ROLL NO. 024 · 24 EXP</div>
            <div className="absolute -right-2 top-5 hidden -rotate-90 font-mono text-[9px] tracking-[.2em] text-[#6e675e] sm:block">EXPOSED TO LIFE</div>
          </div>
        </div>
        <div className="mt-16 flex items-center justify-between border-t border-white/10 pt-5 text-[10px] tracking-[.18em] text-[#625d55]">
          <span className="flex items-center gap-2"><Circle size={7} className="fill-[#a33a32] text-[#a33a32]" /> One roll for everyone who was there.</span>
          <a href="#how-it-works" className="hidden items-center gap-2 sm:flex">How it works <ArrowDown size={12}/></a>
          <a href="#how-it-works" className="flex items-center gap-2 sm:hidden">How it works <ArrowDown size={12}/></a>
        </div>
      </section>

      <section id="how-it-works" className="scroll-reveal border-y border-white/10 bg-[#191714] px-5 py-20 sm:px-10 lg:px-16 lg:py-28">
        <div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[.75fr_1.25fr]">
          <div><p className="eyebrow mb-5">MADE FOR THE MOMENT</p><h2 className="font-display text-5xl leading-[.96] tracking-[-.05em] sm:text-6xl">Stay present.<br/><i>Keep the memories.</i></h2><p className="mt-6 max-w-sm text-sm leading-6 text-[#a6a095]">Add photos to one shared roll, then look through them together when the night is over.</p></div>
          <div className="grid divide-y divide-white/10 border-y border-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[{ n:"01", title:"Create a roll", body:"Name the night, set a photo limit, and invite your friends." }, { n:"02", title:"Add your photos", body:"Everyone contributes the moments they captured." }, { n:"03", title:"Open it together", body:"When the roll ends, see the full gallery as a group." }].map((s, index) => <div key={s.n} className={`scroll-reveal scroll-reveal--${index + 1} py-6 sm:px-5 sm:py-2 lg:px-8`}><span className="font-mono text-[10px] text-[#a34b42]">{s.n} / 03</span><h3 className="mt-5 font-display text-2xl">{s.title}</h3><p className="mt-3 text-sm leading-6 text-[#8e887d]">{s.body}</p></div>)}
          </div>
        </div>
        <div className="mx-auto mt-16 flex max-w-[1280px] flex-col justify-between gap-6 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
          <p className="flex items-center gap-2 text-[11px] text-[#777168]"><Sparkles size={14} className="text-[#a34b42]"/> Keep every photo in one shared place.</p>
          <Link href="/rolls/new" className="button-secondary w-fit">Create your first roll <ArrowUpRight size={15}/></Link>
        </div>
      </section>
      <footer className="flex flex-col gap-3 px-5 py-7 text-xs text-[#686258] sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-16"><span>© Afterhours</span><span>A shared camera roll for nights out.</span><InstallGuideLink className="text-[#aaa396] underline decoration-white/20 underline-offset-4 hover:text-white">Install guide</InstallGuideLink></footer>
    </main>
  );
}

export default function Home() {
  return <HomeExperience browser={<BrowserHome/>}/>;
}
