alter table public.rolls
  add column if not exists awards_profanity boolean default true,
  add column if not exists awards_roast_intensity text default 'unhinged',
  add column if not exists awards_humor_style text default 'brainrot';

update public.rolls
set awards_profanity = coalesce(awards_profanity, true),
    awards_roast_intensity = case
      when awards_roast_intensity in ('mild', 'unhinged', 'savage') then awards_roast_intensity
      else 'unhinged'
    end,
    awards_humor_style = case
      when awards_humor_style in ('brainrot', 'dry_sarcasm', 'fake_hype', 'unfiltered_friend') then awards_humor_style
      else 'brainrot'
    end;

alter table public.rolls
  alter column awards_profanity set default true,
  alter column awards_profanity set not null,
  alter column awards_roast_intensity set default 'unhinged',
  alter column awards_roast_intensity set not null,
  alter column awards_humor_style set default 'brainrot',
  alter column awards_humor_style set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'rolls_awards_roast_intensity_check'
      and conrelid = 'public.rolls'::regclass
  ) then
    alter table public.rolls add constraint rolls_awards_roast_intensity_check
      check (awards_roast_intensity in ('mild', 'unhinged', 'savage'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'rolls_awards_humor_style_check'
      and conrelid = 'public.rolls'::regclass
  ) then
    alter table public.rolls add constraint rolls_awards_humor_style_check
      check (awards_humor_style in ('brainrot', 'dry_sarcasm', 'fake_hype', 'unfiltered_friend'));
  end if;
end;
$$;

-- The host-guest migration restricts authenticated access to named roll columns.
-- Expose these preferences to roll members and allow owners to update only them.
grant select (awards_profanity, awards_roast_intensity, awards_humor_style)
  on public.rolls to authenticated;
grant update (awards_profanity, awards_roast_intensity, awards_humor_style)
  on public.rolls to authenticated;
