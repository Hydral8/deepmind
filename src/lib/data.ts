export interface Show {
  id: string;
  title: string;
  description: string;
  genre: string[];
  year: number;
  rating: string;
  seasons: number;
  image: string;
  banner: string;
  creator: string;
  stars: string[];
  type: "series" | "movie";
  episodes: Episode[];
}

export interface Episode {
  id: string;
  showId: string;
  number: number;
  season: number;
  title: string;
  description: string;
  duration: string;
  thumbnail: string;
  videoUrl?: string;
  branches: Branch[];
}

export interface Branch {
  id: string;
  episodeId: string;
  title: string;
  description: string;
  author: string;
  createdAt: string;
  likes: number;
  scenes: Scene[];
  forkPoint: string;
}

export interface Scene {
  id: string;
  branchId: string;
  order: number;
  description: string;
  dialogue: string;
  imageUrl: string;
  characters: Character[];
  music?: string;
}

export interface Character {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

// ──────────────────────── TV SHOWS ────────────────────────

export const SHOWS: Show[] = [
  // ── The Twilight Zone (real episodes with video) ──
  {
    id: "twilight-zone",
    title: "The Twilight Zone",
    description:
      "A journey into a wondrous land of imagination. Each episode is a standalone story blending science fiction, fantasy, and psychological thriller.",
    genre: ["Sci-Fi", "Thriller", "Drama"],
    year: 1959,
    rating: "TV-PG",
    seasons: 5,
    image: "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=600&h=400&fit=crop",
    banner: "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=1400&h=800&fit=crop",
    creator: "Rod Serling",
    stars: ["Rod Serling", "Burgess Meredith", "William Shatner"],
    type: "series",
    episodes: [
      {
        id: "tz-s1e1",
        showId: "twilight-zone",
        number: 1,
        season: 1,
        title: "Where Is Everybody?",
        description:
          "A man finds himself alone in a seemingly deserted town with no memory of who he is or how he got there. As he searches for answers, reality begins to blur.",
        duration: "25 min",
        thumbnail: "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=400&h=225&fit=crop",
        videoUrl: "/movies/twilight_zone/twilight-zone-s01e01.mp4",
        branches: [],
      },
      {
        id: "tz-s1e8",
        showId: "twilight-zone",
        number: 8,
        season: 1,
        title: "Time Enough at Last",
        description:
          "Henry Bemis, a bookworm bank teller constantly denied time to read, survives a nuclear apocalypse. Alone at last, he finally has time enough to read every book in the world.",
        duration: "25 min",
        thumbnail: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=400&h=225&fit=crop",
        videoUrl: "/movies/twilight_zone/twilight-zone-s01e08.mp4",
        branches: [],
      },
    ],
  },

  // ── Movies (with video) ──
  {
    id: "tears-of-steel",
    title: "Tears of Steel",
    description:
      "In a dystopian future, a group of warriors and scientists must fight to save the world from a powerful AI. A story of love, loss, and humanity's last stand against the machines.",
    genre: ["Sci-Fi", "Action", "Drama"],
    year: 2012,
    rating: "PG-13",
    seasons: 1,
    image: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=600&h=400&fit=crop",
    banner: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=1400&h=800&fit=crop",
    creator: "Ian Hubert",
    stars: ["Derek de Lint", "Sergio Hasselbaink", "Rogier Schippers"],
    type: "movie",
    episodes: [
      {
        id: "tos-full",
        showId: "tears-of-steel",
        number: 1,
        season: 1,
        title: "Tears of Steel",
        description: "The full film. A sci-fi epic about fighting to reclaim humanity from rogue artificial intelligence.",
        duration: "12 min",
        thumbnail: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=400&h=225&fit=crop",
        videoUrl: "/movies/tears_of_steel/tears-of-steel.mp4",
        branches: [],
      },
    ],
  },
  {
    id: "big-buck-bunny",
    title: "Big Buck Bunny",
    description:
      "A giant rabbit finds peace in a sunny meadow, until three bullying rodents push him too far. A story of nature's gentle wrath.",
    genre: ["Animation", "Comedy", "Short"],
    year: 2008,
    rating: "G",
    seasons: 1,
    image: "/movies/big_buck_bunny/thumbnail.jpg",
    banner: "/movies/big_buck_bunny/banner.jpg",
    creator: "Sacha Goedegebure",
    stars: ["Big Buck", "Frank", "Rinky", "Gimera"],
    type: "movie",
    episodes: [
      {
        id: "bbb-full",
        showId: "big-buck-bunny",
        number: 1,
        season: 1,
        title: "Big Buck Bunny",
        description: "The full film. A lovable rabbit's peaceful life is disrupted by three mischievous rodents.",
        duration: "10 min",
        thumbnail: "/movies/big_buck_bunny/thumbnail.jpg",
        videoUrl: "/movies/big_buck_bunny/big-buck-bunny.mp4",
        branches: [],
      },
    ],
  },
  {
    id: "sintel",
    title: "Sintel",
    description:
      "A lonely young woman searches for her lost baby dragon companion. Her quest leads her through dangerous lands and towards a devastating truth.",
    genre: ["Animation", "Fantasy", "Adventure"],
    year: 2010,
    rating: "PG",
    seasons: 1,
    image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=400&fit=crop",
    banner: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1400&h=800&fit=crop",
    creator: "Colin Levy",
    stars: ["Halina Reijn", "Thom Hoffman"],
    type: "movie",
    episodes: [
      {
        id: "sintel-full",
        showId: "sintel",
        number: 1,
        season: 1,
        title: "Sintel",
        description: "A young woman's epic quest to find her dragon, through treacherous lands and heartbreak.",
        duration: "15 min",
        thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=225&fit=crop",
        videoUrl: "/movies/sintel/sintel.mp4",
        branches: [],
      },
    ],
  },

  // ── Game of Thrones clip ──
  {
    id: "game-of-thrones",
    title: "Game of Thrones",
    description:
      "Nine noble families fight for control over the lands of Westeros, while an ancient enemy returns after being dormant for millennia.",
    genre: ["Fantasy", "Drama", "Action"],
    year: 2011,
    rating: "TV-MA",
    seasons: 8,
    image: "/movies/got/thumbnail.jpg",
    banner: "/movies/got/banner.jpg",
    creator: "David Benioff & D.B. Weiss",
    stars: ["Emilia Clarke", "Kit Harington", "Peter Dinklage"],
    type: "series",
    episodes: [
      {
        id: "got-s8-clip",
        showId: "game-of-thrones",
        number: 6,
        season: 8,
        title: "The Iron Throne",
        description: "The finale. Daenerys must face the consequences of her actions. Jon Snow makes a fateful choice.",
        duration: "1 min",
        thumbnail: "/movies/got/thumbnail.jpg",
        videoUrl: "/movies/got/got_daenaerys_dies.mp4",
        branches: [
          {
            id: "got-b1",
            episodeId: "got-s8-clip",
            title: "Daenerys Lives",
            description: "The most requested alternate ending ever. What if Jon couldn't go through with it?",
            author: "throne_rewriter",
            createdAt: "2025-03-01",
            likes: 2847,
            forkPoint: "0:30",
            scenes: [
              {
                id: "s1",
                branchId: "got-b1",
                order: 1,
                description: "Jon drops the dagger. He can't do it. Daenerys turns, sees the blade on the ground, and understands what almost happened.",
                dialogue: '"You would have killed me." - Daenerys\n"I couldn\'t. I love you." - Jon',
                imageUrl: "",
                characters: [
                  { id: "c1", name: "Daenerys", avatar: "", color: "#888" },
                  { id: "c2", name: "Jon Snow", avatar: "", color: "#666" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ── Additional shows (no video, placeholders) ──
  {
    id: "dark-horizons",
    title: "Dark Horizons",
    description:
      "In a world where parallel dimensions collide, a team of scientists must navigate fractured realities to prevent the collapse of all existence.",
    genre: ["Sci-Fi", "Thriller", "Drama"],
    year: 2024,
    rating: "TV-MA",
    seasons: 3,
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&h=400&fit=crop",
    banner: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1400&h=800&fit=crop",
    creator: "Anna Volkov",
    stars: ["Elena Vasquez", "Marcus Chen", "Director Patel"],
    type: "series",
    episodes: [
      {
        id: "dh-s1e1",
        showId: "dark-horizons",
        number: 1,
        season: 1,
        title: "The First Fracture",
        description: "Dr. Elena Vasquez discovers an anomaly in the quantum field that suggests parallel dimensions are merging.",
        duration: "52 min",
        thumbnail: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400&h=225&fit=crop",
        branches: [],
      },
    ],
  },
  {
    id: "crown-of-embers",
    title: "Crown of Embers",
    description:
      "A medieval fantasy epic following rival houses vying for control of a magical throne that grants dominion over fire itself.",
    genre: ["Fantasy", "Drama", "Action"],
    year: 2023,
    rating: "TV-MA",
    seasons: 2,
    image: "https://images.unsplash.com/photo-1533035353720-f1c6a75cd8ab?w=600&h=400&fit=crop",
    banner: "https://images.unsplash.com/photo-1533035353720-f1c6a75cd8ab?w=1400&h=800&fit=crop",
    creator: "James Harwick",
    stars: ["Lord Aldric", "Queen Sera", "Knight Riven"],
    type: "series",
    episodes: [
      {
        id: "ce-s1e1",
        showId: "crown-of-embers",
        number: 1,
        season: 1,
        title: "The Burning Throne",
        description: "House Aldric claims the Ember Crown, igniting a war that will consume the realm.",
        duration: "58 min",
        thumbnail: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=225&fit=crop",
        branches: [],
      },
    ],
  },
  {
    id: "neon-syndicate",
    title: "Neon Syndicate",
    description:
      "In a cyberpunk megacity, an underground hacker collective takes on corrupt megacorporations controlling every aspect of human life.",
    genre: ["Cyberpunk", "Action", "Thriller"],
    year: 2025,
    rating: "TV-14",
    seasons: 1,
    image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&h=400&fit=crop",
    banner: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1400&h=800&fit=crop",
    creator: "Mira Tanaka",
    stars: ["Kai Zero", "Nyx", "Agent Webb"],
    type: "series",
    episodes: [
      {
        id: "ns-s1e1",
        showId: "neon-syndicate",
        number: 1,
        season: 1,
        title: "Blackout",
        description: "A city-wide blackout reveals the megacorps' darkest secret.",
        duration: "45 min",
        thumbnail: "https://images.unsplash.com/photo-1515630278258-407f66498911?w=400&h=225&fit=crop",
        branches: [],
      },
    ],
  },
  {
    id: "the-last-colony",
    title: "The Last Colony",
    description:
      "Humanity's final settlement on a distant planet faces extinction as the environment turns hostile and ancient secrets surface.",
    genre: ["Sci-Fi", "Survival", "Mystery"],
    year: 2024,
    rating: "TV-14",
    seasons: 1,
    image: "https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=600&h=400&fit=crop",
    banner: "https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=1400&h=800&fit=crop",
    creator: "David Osei",
    stars: ["Commander Reyes", "Dr. Lin", "Settler Kova"],
    type: "series",
    episodes: [
      {
        id: "tlc-s1e1",
        showId: "the-last-colony",
        number: 1,
        season: 1,
        title: "Landfall",
        description: "The colonists arrive on Kepler-442b to find conditions far different than projected.",
        duration: "55 min",
        thumbnail: "https://images.unsplash.com/photo-1454789548928-9efd52dc4031?w=400&h=225&fit=crop",
        branches: [],
      },
    ],
  },
];

export function getShow(id: string): Show | undefined {
  return SHOWS.find((s) => s.id === id);
}

export function getEpisode(showId: string, episodeId: string): Episode | undefined {
  const show = getShow(showId);
  return show?.episodes.find((e) => e.id === episodeId);
}

export function getBranch(
  showId: string,
  episodeId: string,
  branchId: string
): Branch | undefined {
  const episode = getEpisode(showId, episodeId);
  return episode?.branches.find((b) => b.id === branchId);
}

export function getAllBranches(): (Branch & { showTitle: string; episodeTitle: string; showId: string; episodeId: string })[] {
  const branches: (Branch & { showTitle: string; episodeTitle: string; showId: string; episodeId: string })[] = [];
  for (const show of SHOWS) {
    for (const ep of show.episodes) {
      for (const branch of ep.branches) {
        branches.push({ ...branch, showTitle: show.title, episodeTitle: ep.title, showId: show.id, episodeId: ep.id });
      }
    }
  }
  return branches.sort((a, b) => b.likes - a.likes);
}

export function getMovies(): Show[] {
  return SHOWS.filter((s) => s.type === "movie");
}

export function getSeries(): Show[] {
  return SHOWS.filter((s) => s.type === "series");
}
