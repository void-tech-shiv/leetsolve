CREATE TABLE IF NOT EXISTS solutions (
  id BIGSERIAL PRIMARY KEY,
  challenge_date DATE NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  problem_url TEXT NOT NULL,
  language TEXT NOT NULL,
  code TEXT NOT NULL,
  explanation TEXT NOT NULL,
  time_complexity TEXT NOT NULL,
  space_complexity TEXT NOT NULL,
  status TEXT NOT NULL,
  judge_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(challenge_date, language)
);
