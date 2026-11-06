"use client";

import Link from "next/link";
import { ArrowRight, Camera, KeyRound, Plus } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { useAuth } from "@/components/auth-provider";
import { PhotoImage } from "@/components/photo-image";
import { useInstalledApp } from "@/components/use-installed-app";
import { formatDate, PhotoCount } from "@/components/roll-ui";

function InstalledHome() {
  const { rolls, ready } = useApp();
  const { user, configured } = useAuth();
  const active = rolls.filter((roll) => roll.status === "active");
  const revealed = rolls.filter((roll) => roll.status === "revealed");
  const guest = Boolean(user?.is_anonymous);

  return <main className="installed-home">
    <section className="installed-home__intro">
      <p className="eyebrow">THE GOOD NIGHTS</p>
      <h1 className="font-display">Keep the night.</h1>
      <div className="installed-home__actions">
        {!guest && <Link href="/rolls/new" className="button-primary"><Plus size={17}/> Create a roll</Link>}
        <Link href="/join" className="button-secondary"><KeyRound size={16}/> Join a roll</Link>
      </div>
      {configured && !user && <p className="installed-home__signin">Host a roll? <Link href="/login?next=%2Frolls%2Fnew">Sign in</Link></p>}
    </section>

    {!ready ? <p className="installed-home__loading" role="status">Opening your rolls…</p> : <>
      {active.length > 0 && <section className="installed-home__section">
        <div className="installed-home__section-heading"><h2>In progress</h2><span>{active.length}</span></div>
        <div className="installed-home__roll-list">{active.map((roll) => <Link key={roll.id} href={`/rolls/${roll.id}`} className="installed-roll installed-roll--active">
          <span className="installed-roll__mark"><Camera size={17}/></span><span className="installed-roll__copy"><strong>{roll.name}</strong><small>{formatDate(roll.endsAt, { hour: "numeric", minute: "2-digit" })} · <PhotoCount roll={roll}/></small></span><ArrowRight size={16}/>
        </Link>)}</div>
      </section>}

      {revealed.length > 0 && <section className="installed-home__section">
        <div className="installed-home__section-heading"><h2>Recently revealed</h2><Link href="/dashboard">All rolls <ArrowRight size={13}/></Link></div>
        <div className="installed-recent-list">{revealed.slice(0, 5).map((roll) => <Link key={roll.id} href={`/rolls/${roll.id}/reveal`} className="installed-recent">
          <span className="installed-recent__cover">{roll.photos[0] ? <PhotoImage src={roll.photos[0].src} thumbnailSrc={roll.photos[0].thumbnailSrc} alt="" loading="lazy"/> : <Camera size={17}/>}</span>
          <span className="installed-recent__copy"><strong>{roll.name}</strong><small>{roll.photos.length} photos · {formatDate(roll.createdAt, { month: "short", day: "numeric" })}</small></span><ArrowRight size={15}/>
        </Link>)}</div>
      </section>}

      {!active.length && !revealed.length && <section className="installed-home__empty">
        <span className="installed-home__empty-icon"><Camera size={21}/></span><h2>Your rolls show up here.</h2><p>Start one for tonight or join one a friend shared.</p>
      </section>}
    </>}
  </main>;
}

export function HomeExperience({ browser }: { browser: React.ReactNode }) {
  const installed = useInstalledApp();
  if (installed === null) return <div className="home-experience-pending" aria-busy="true"/>;
  return installed ? <InstalledHome/> : <>{browser}</>;
}
