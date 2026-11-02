CREATE TABLE logo_files(key TEXT PRIMARY KEY, content_type TEXT NOT NULL, size INTEGER NOT NULL, created INTEGER NOT NULL);
CREATE TABLE logo_chunks(key TEXT NOT NULL, position INTEGER NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(key,position));
CREATE INDEX buzz_player_history ON buzzes(room,player,response_ms);
CREATE INDEX buzz_question_history ON buzzes(room,round,id);
CREATE INDEX team_session ON teams(room);
CREATE INDEX player_session ON players(room);
