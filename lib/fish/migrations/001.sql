-- Fish Manitoba social + contests backend — migration 001
-- Creates all fm_* tables. Safe to re-run (IF NOT EXISTS).
-- Run ONCE against the Neon database with the DIRECT (non-pooled) connection string:
--   psql "$DATABASE_URL_DIRECT" -f lib/fish/migrations/001.sql
-- Do NOT run against production without approval.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Users (Google sign-in) + play-money wallet
-- play_balance is the source of truth (integer chips, never real money).
-- fm_ledger is the append-only audit trail; every balance mutation writes
-- a ledger row in the SAME transaction as the balance update.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fm_users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub    text        UNIQUE NOT NULL,
  name          text        NOT NULL,
  email         text,
  avatar_url    text,
  stats_public  boolean     NOT NULL DEFAULT true,
  play_balance  integer     NOT NULL DEFAULT 1000 CHECK (play_balance >= 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fm_sessions (
  token       text        PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fm_sessions_user_idx    ON fm_sessions(user_id);
CREATE INDEX IF NOT EXISTS fm_sessions_expires_idx ON fm_sessions(expires_at);

-- ---------------------------------------------------------------------------
-- Friendships (symmetric pair; status pending -> accepted)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fm_friendships (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  uuid        NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
  addressee_id  uuid        NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','accepted','blocked')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fm_friendships_no_self CHECK (requester_id <> addressee_id)
);
-- One row per unordered pair, regardless of direction:
CREATE UNIQUE INDEX IF NOT EXISTS fm_friendships_symmetric_unique
  ON fm_friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
CREATE INDEX IF NOT EXISTS fm_friendships_addressee_idx ON fm_friendships(addressee_id);

-- ---------------------------------------------------------------------------
-- Catches (the social feed + the raw material for contest scoring)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fm_catches (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid          NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
  species           text          NOT NULL,
  length_in         numeric(6,2)  NOT NULL CHECK (length_in > 0),
  weight_lb         numeric(6,2)  CHECK (weight_lb IS NULL OR weight_lb > 0),
  photo_measure_url text          NOT NULL,
  photo_hold_url    text          NOT NULL,
  visibility        text          NOT NULL DEFAULT 'public'
                                  CHECK (visibility IN ('public','friends','private')),
  note              text,
  caught_at         timestamptz   NOT NULL DEFAULT now(),
  created_at        timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fm_catches_user_idx    ON fm_catches(user_id);
CREATE INDEX IF NOT EXISTS fm_catches_created_idx ON fm_catches(created_at DESC);
CREATE INDEX IF NOT EXISTS fm_catches_species_idx ON fm_catches(species);
CREATE INDEX IF NOT EXISTS fm_catches_caught_idx  ON fm_catches(caught_at);

-- ---------------------------------------------------------------------------
-- Contests (friendly competitions; stakes are PLAY MONEY chips, never cash)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fm_contests (
  id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id         uuid         NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
  title              text         NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  type               text         NOT NULL CHECK (type IN (
                                     'most_fish',
                                     'biggest_fish',
                                     'most_over_size',
                                     'most_over_size_daily_limit'
                                   )),
  species            text,  -- NULL = any species
  size_threshold_in  numeric(6,2) CHECK (size_threshold_in IS NULL OR size_threshold_in > 0),
  daily_limit        integer      CHECK (daily_limit IS NULL OR daily_limit > 0),
  period             text         NOT NULL CHECK (period IN ('daily','weekly','monthly','seasonal')),
  starts_at          timestamptz  NOT NULL,
  ends_at            timestamptz  NOT NULL,
  visibility         text         NOT NULL DEFAULT 'public'
                                   CHECK (visibility IN ('public','friends','invite')),
  invite_code        text,
  stake              integer      NOT NULL DEFAULT 0 CHECK (stake >= 0),
  status             text         NOT NULL DEFAULT 'open'
                                   CHECK (status IN ('open','settled','cancelled')),
  winner_user_id     uuid         REFERENCES fm_users(id) ON DELETE SET NULL,
  created_at         timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT fm_contests_dates CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS fm_contests_creator_idx ON fm_contests(creator_id);
CREATE INDEX IF NOT EXISTS fm_contests_status_idx ON fm_contests(status);

CREATE TABLE IF NOT EXISTS fm_contest_entries (
  contest_id  uuid        NOT NULL REFERENCES fm_contests(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
  stake_paid  integer     NOT NULL DEFAULT 0 CHECK (stake_paid >= 0),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id)
);
CREATE INDEX IF NOT EXISTS fm_contest_entries_user_idx ON fm_contest_entries(user_id);

-- ---------------------------------------------------------------------------
-- Play-money ledger (append-only; one row per balance change)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fm_ledger (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
  contest_id  uuid        REFERENCES fm_contests(id) ON DELETE SET NULL,
  amount      integer     NOT NULL CHECK (amount <> 0),
  reason      text        NOT NULL CHECK (reason IN (
                              'contest_entry',  -- stake deducted on join (negative)
                              'contest_win',    -- pot paid out on settle (positive)
                              'signup_bonus',   -- starting chips for new users (positive)
                              'adjustment'      -- manual admin correction (signed)
                            )),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fm_ledger_user_idx    ON fm_ledger(user_id);
CREATE INDEX IF NOT EXISTS fm_ledger_contest_idx ON fm_ledger(contest_id);
