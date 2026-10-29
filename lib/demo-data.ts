import type { Roll } from "@/lib/types";

const friends = [
  { name: "Maya Chen", initials: "MC", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" },
  { name: "Leo Park", initials: "LP", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80" },
  { name: "Sam Rivera", initials: "SR", avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=100&q=80" },
  { name: "Alex Morgan", initials: "AM", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=100&q=80" },
];

export function createDemoRolls(): Roll[] {
  const now = new Date();
  const activeEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const activeStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDays = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  return [
    {
      id: "demo-last-call", name: "Last call, no plans", theme: "After dark", status: "active",
      createdAt: activeStart.toISOString(), endsAt: activeEnd.toISOString(), photoLimit: 24, inviteCode: "L8Q2PX",
      participants: friends,
      photos: [
        { id: "d1", src: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1000&q=85", caption: "we said one drink", by: "Maya Chen", at: new Date(now.getTime() - 90 * 60 * 1000).toISOString() },
        { id: "d2", src: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1000&q=85", caption: "the birthday girl!!", by: "Leo Park", at: new Date(now.getTime() - 65 * 60 * 1000).toISOString() },
        { id: "d3", src: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1000&q=85", caption: "outside for a minute", by: "Sam Rivera", at: new Date(now.getTime() - 34 * 60 * 1000).toISOString() },
      ],
    },
    {
      id: "demo-sunday-film", name: "Sunday looked like this", theme: "Soft focus", status: "revealed",
      createdAt: twoDays.toISOString(), endsAt: yesterday.toISOString(), photoLimit: 18, inviteCode: "SNDY04",
      participants: friends.slice(0, 3),
      photos: [
        { id: "s1", src: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1200&q=85", caption: "before anyone was awake", by: "Maya Chen", at: new Date(twoDays.getTime() + 35 * 60 * 1000).toISOString() },
        { id: "s2", src: "https://images.unsplash.com/photo-1511988617509-a57c8a288659?auto=format&fit=crop&w=1200&q=85", caption: "the long way home", by: "Sam Rivera", at: new Date(twoDays.getTime() + 130 * 60 * 1000).toISOString() },
        { id: "s3", src: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85", caption: "same booth, every time", by: "Leo Park", at: new Date(twoDays.getTime() + 205 * 60 * 1000).toISOString() },
        { id: "s4", src: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=85", caption: "proof we made it out", by: "Maya Chen", at: new Date(twoDays.getTime() + 315 * 60 * 1000).toISOString() },
        { id: "s5", src: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=85", caption: "one for the camera", by: "Sam Rivera", at: new Date(twoDays.getTime() + 390 * 60 * 1000).toISOString() },
      ],
    },
    {
      id: "demo-rooftop", name: "Rooftop / 1:13 am", theme: "Flash on", status: "revealed",
      createdAt: new Date(twoDays.getTime() - 2 * 86400000).toISOString(), endsAt: twoDays.toISOString(), photoLimit: 12, inviteCode: "R00F13",
      participants: friends.slice(1),
      photos: [
        { id: "r1", src: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=85", caption: "no one remembers the playlist", by: "Leo Park", at: new Date(twoDays.getTime() - 110 * 60 * 1000).toISOString() },
        { id: "r2", src: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=85", caption: "caught between songs", by: "Alex Morgan", at: new Date(twoDays.getTime() - 45 * 60 * 1000).toISOString() },
        { id: "r3", src: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1200&q=85", caption: "the last good idea", by: "Sam Rivera", at: new Date(twoDays.getTime() - 15 * 60 * 1000).toISOString() },
      ],
    },
  ];
}
