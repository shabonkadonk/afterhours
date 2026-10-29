export type Photo = {
  id: string;
  src: string;
  caption: string;
  by: string;
  at: string;
  filter?: string;
  filterVersion?: number;
  dateStampYear?: "current" | "2006";
  cloudinaryPublicId?: string;
  cloudinaryOriginalSrc?: string;
};

export type Participant = {
  name: string;
  initials: string;
  avatar?: string;
};

export type Roll = {
  id: string;
  ownerId?: string;
  name: string;
  theme: string;
  status: "active" | "revealed";
  createdAt: string;
  endsAt: string;
  photoLimit: number;
  inviteCode: string;
  participants: Participant[];
  photos: Photo[];
};
