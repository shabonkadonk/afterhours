alter table public.rolls
  add column awards_profanity boolean not null default true,
  add column awards_roast_intensity text not null default 'unhinged'
    check (awards_roast_intensity in ('mild', 'unhinged', 'savage')),
  add column awards_humor_style text not null default 'brainrot'
    check (awards_humor_style in ('brainrot', 'dry_sarcasm', 'fake_hype', 'unfiltered_friend'));
