type Input = Record<string, any>;
export class GameError extends Error { status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }
const classes = ['SS1 Sapphire','SS1 Emerald','SS2 Sapphire','SS2 Emerald','SS3 Sapphire','SS3 Emerald'];
// Existing rooms acquire class rosters without altering any previous contestant or buzz record.
async function seedTeams(db: D1Database, code: string) {
  const statements: D1PreparedStatement[] = [];
  classes.forEach((name, sort) => {
    const team = code + ':' + name.toLowerCase().replace(' ', '-');
    statements.push(db.prepare('INSERT OR IGNORE INTO teams(id,room,name,sort) VALUES(?,?,?,?)').bind(team, code, name, sort));
    for (let seat = 1; seat <= 4; seat++) statements.push(db.prepare('INSERT OR IGNORE INTO players(id,room,name,team,seat) VALUES(?,?,?,?,?)').bind(team + ':' + seat, code, '', team, seat));
  });
  await db.batch(statements);
}
export async function handleGame(b: Input, db: D1Database, now = Date.now(), userId: string | null = null) {
  const code = String(b.code || '').trim().toUpperCase();
  const run = (sql: string, ...v: any[]) => db.prepare(sql).bind(...v);
  if (b.action === 'rooms') {
    if (!userId) throw new GameError('Sign in to view your competitions.', 401);
    const result = await run('SELECT code,title,round,competition_round AS competitionRound,question,armed,created FROM rooms WHERE owner=? AND deleted=0 AND created>? ORDER BY created DESC', userId, now - 86400000).all();
    return { rooms: result.results };
  }
  if (b.action === 'create') {
    if (!userId) throw new GameError('Sign in to create a competition.', 401);
    let c = ''; const secret = crypto.randomUUID();
    for (let attempt=0;attempt<100;attempt++) {
      const bytes=crypto.getRandomValues(new Uint32Array(2));
      const candidate=String(bytes[0]%1000000).padStart(6,'0');
      const inserted=await run('INSERT OR IGNORE INTO rooms(code,secret,title,created,owner) VALUES(?,?,?,?,?)', candidate, secret, String(b.title || 'PIC Inter-Class Competition').trim().slice(0,80), now, userId).run();
      if(inserted.meta.changes){c=candidate;break;}
    }
    if(!c) throw new GameError('No session codes are available. Please try again.',503);
    await seedTeams(db, c);
    return { code: c, secret };
  }
  let room = await run('SELECT * FROM rooms WHERE code=?', code).first<any>();
  if(b.action==='delete_session') {
    if(!userId) throw new GameError('Sign in to delete a session.',401);
    if(!room || room.owner!==userId) throw new GameError('Only the host account that created this session can delete it.',403);
    if(b.confirm!==true) throw new GameError('Confirm session deletion.');
    // Retain the code as a tombstone so old invite links can never open a new session.
    await run('UPDATE rooms SET deleted=1,armed=0 WHERE code=? AND owner=?',code,userId).run();
    return {deleted:true,code};
  }
  if (!room || room.deleted || now - room.created > 86400000) throw new GameError('Session not found or expired. Ask the host for the current session code.', 404);
  // Resume sessions created before questions and round-level modes were introduced.
  if(room.round>0 && room.competition_round===1 && room.question===0 && room.phase==='ready') {
    await run("UPDATE rooms SET phase='live',question=round,round_locked=1 WHERE code=? AND competition_round=1 AND question=0 AND phase='ready'",code).run();
    room=await run('SELECT * FROM rooms WHERE code=?',code).first<any>();
  }
  if(room.armed && room.time_limit>0 && room.started_at!=null) {
    await run("UPDATE rooms SET armed=0,phase='scores' WHERE code=? AND armed=1 AND time_limit>0 AND started_at+time_limit*1000<=CAST(unixepoch('subsec')*1000 AS INTEGER)",code).run();
    room=await run('SELECT * FROM rooms WHERE code=?',code).first<any>();
  }
  if (b.action === 'resume') {
    if (!userId || room.owner !== userId) throw new GameError('This competition belongs to another host account.', 403);
    return { code, secret: room.secret };
  }
  const existing = await run('SELECT id FROM teams WHERE room=? LIMIT 1', code).first();
  if (!existing) await seedTeams(db, code);
  const host = typeof b.secret === 'string' && b.secret === room.secret && (!room.owner || room.owner === userId);
  if (host && userId && !room.owner) await run('UPDATE rooms SET owner=? WHERE code=? AND owner IS NULL', userId, code).run();
  if (['arm','lock','score','team','roster','release','buzz_mode','judge','finish_question','next_round','round_settings'].includes(b.action) && !host) throw new GameError('Host access required.', 403);
  if(b.action==='round_settings') {
    const rounds=b.rounds ?? room.round_count;
    if(!Number.isInteger(rounds)||rounds<room.competition_round||rounds<1||rounds>20) throw new GameError('Choose 1–20 rounds, including the current round.');
    if(room.competition_round>1&&rounds!==room.round_count) throw new GameError('The number of rounds is locked after the competition starts.');
    if(!Number.isInteger(b.questions)||b.questions<1||b.questions>200||!Number.isInteger(b.seconds)||b.seconds<0||b.seconds>600) throw new GameError('Choose 1–200 questions and a time limit of 0–600 seconds.');
    const changed=await run('UPDATE rooms SET question_count=?,time_limit=?,round_count=? WHERE code=? AND round_locked=0 AND armed=0 AND (competition_round=1 OR round_count=?)',b.questions,b.seconds,rounds,code,rounds).run();
    if(!changed.meta.changes) throw new GameError('Round settings are locked. Start a new round to change them.');
  }
  if (b.action === 'buzz_mode') {
    if (room.round_locked || room.armed) throw new GameError('Buzz-in mode is locked for this round. Start a new round to change it.');
    if (typeof b.multiple !== 'boolean') throw new GameError('Choose a buzz-in mode.');
    const changed = await run('UPDATE rooms SET multiple_buzzes=? WHERE code=? AND armed=0 AND round_locked=0', b.multiple ? 1 : 0, code).run();
    if (!changed.meta.changes) throw new GameError('Buzz-in mode is locked for this round. Start a new round to change it.');
  }
  if (b.action === 'join') {
    const team = await run('SELECT * FROM teams WHERE id=? AND room=?', b.team || '', code).first<any>();
    if (!team || !team.enabled) throw new GameError('This class is omitted from the competition. Choose an active class.');
    const seat = Number(b.seat);
    if (![1,2,3,4].includes(seat)) throw new GameError('Choose one of the four student places.');
    const student = await run('SELECT * FROM players WHERE room=? AND team=? AND seat=?', code, team.id, seat).first<any>();
    if (!student || student.token) throw new GameError('This student is already connected. Use the original tab, or ask the host to release the device.');
    const name = student.name || String(b.name || '').trim().slice(0, 40);
    if (!name) throw new GameError('Enter the student’s name.');
    const token = crypto.randomUUID();
    const result = await run(`UPDATE players SET token=?,name=? WHERE id=? AND token='' AND EXISTS(SELECT 1 FROM teams WHERE id=? AND room=? AND enabled=1)`, token, name, student.id, team.id, code).run();
    if (!result.meta.changes) throw new GameError('This place is no longer available. Refresh the class list.');
    return { id: student.id, token };
  }
  if (b.action === 'arm') {
    const missing=await run("SELECT t.name FROM teams t WHERE t.room=? AND t.enabled=1 AND NOT EXISTS(SELECT 1 FROM players p WHERE p.team=t.id AND p.room=t.room AND p.token!='')",code).all();
    if(missing.results.length) throw new GameError('Waiting for a contestant in: '+missing.results.map((t:any)=>t.name).join(', ')+'. Omit classes that are not taking part.');
    const included=await run('SELECT id FROM teams WHERE room=? AND enabled=1 LIMIT 1',code).first();
    if(!included) throw new GameError('Include at least one class with a signed-in contestant before starting.');
    const changed=await run("UPDATE rooms SET round=round+1,question=question+1,armed=1,round_locked=1,phase='live',started_at=CAST(unixepoch('subsec')*1000 AS INTEGER) WHERE code=? AND deleted=0 AND round=? AND phase IN ('ready','scores') AND question<question_count AND competition_round<=round_count AND EXISTS(SELECT 1 FROM teams t WHERE t.room=rooms.code AND t.enabled=1) AND NOT EXISTS(SELECT 1 FROM teams t WHERE t.room=rooms.code AND t.enabled=1 AND NOT EXISTS(SELECT 1 FROM players p WHERE p.room=t.room AND p.team=t.id AND p.token!=''))",code,b.round ?? room.round).run();
    if(!changed.meta.changes) throw new GameError('Score or end the current question before proceeding.');
  }
  if (b.action === 'next_round') {
    const changed=await run("UPDATE rooms SET competition_round=competition_round+1,question=0,armed=0,phase='ready',round_locked=0,started_at=NULL WHERE code=? AND round=? AND phase='scores' AND competition_round<round_count",code,b.round ?? room.round).run();
    if(!changed.meta.changes) throw new GameError('End the current question before starting a new round.');
  }
  if (b.action === 'finish_question') await run("UPDATE rooms SET armed=0,phase='scores' WHERE code=? AND round=? AND phase='live'",code,b.round).run();
  if (b.action === 'judge') {
    if(!Number.isInteger(b.buzz) || !Number.isInteger(b.round)) throw new GameError('Choose a response from the current question.');
    if(typeof b.correct!=='boolean') throw new GameError('Choose correct or incorrect.');
    const buzz=await run('SELECT id FROM buzzes WHERE id=? AND room=? AND round=?',b.buzz,code,b.round).first();
    if(!buzz || b.round!==room.round || room.phase==='ready') throw new GameError('This response belongs to an earlier question. Refresh the buzz order.');
    // Score differences and verdict are committed together. Retries cannot award twice.
    await db.batch([
      run("UPDATE teams SET score=score+(?-COALESCE((SELECT verdict FROM buzzes WHERE id=?),0)) WHERE room=? AND id=(SELECT team FROM players WHERE id=(SELECT player FROM buzzes WHERE id=?)) AND EXISTS(SELECT 1 FROM rooms WHERE code=? AND round=? AND phase!='ready')",b.correct?1:0,b.buzz,code,b.buzz,code,b.round),
      run("UPDATE buzzes SET verdict=? WHERE id=? AND room=? AND round=? AND EXISTS(SELECT 1 FROM rooms WHERE code=? AND round=? AND phase!='ready')",b.correct?1:0,b.buzz,code,b.round,code,b.round),
      run("UPDATE rooms SET armed=0,phase='scores' WHERE code=? AND round=? AND phase!='ready'",code,b.round),
    ]);
  }
  if (b.action === 'lock') await run('UPDATE rooms SET armed=0 WHERE code=?', code).run();
  if (b.action === 'score') {
    if (b.team) await run('UPDATE teams SET score=score+? WHERE id=? AND room=?', b.delta === -1 ? -1 : 1, b.team, code).run();
    else if (b.player) await run('UPDATE players SET score=score+? WHERE id=? AND room=? AND team IS NULL', b.delta === -1 ? -1 : 1, b.player, code).run();
    await run("UPDATE rooms SET armed=0,phase='scores' WHERE code=? AND phase='live'",code).run();
  }
  if (b.action === 'team') {
    if (typeof b.enabled !== 'boolean') throw new GameError('Choose whether this class is active.');
    await run('UPDATE teams SET enabled=? WHERE id=? AND room=?', b.enabled ? 1 : 0, b.team || '', code).run();
  }
  if (b.action === 'roster') {
    if (room.armed) throw new GameError('Close the buzzers before editing student names.');
    if (!Array.isArray(b.names) || b.names.length !== 4 || !b.names.every((n: unknown) => typeof n === 'string')) throw new GameError('Provide four student names.');
    await db.batch(b.names.map((name: string, i: number) => run('UPDATE players SET name=? WHERE room=? AND team=? AND seat=?', name.trim().slice(0, 40), code, b.team || '', i + 1)));
  }
  if (b.action === 'release') {
    if (room.armed) throw new GameError('Close the buzzers before releasing a contestant device.');
    await run(`UPDATE players SET token='' WHERE id=? AND room=? AND team IS NOT NULL`, b.player || '', code).run();
  }
  if (b.action === 'buzz') {
    const player = await run('SELECT p.id,t.enabled FROM players p LEFT JOIN teams t ON t.id=p.team WHERE p.id=? AND p.room=? AND p.token=? AND p.token!=?', b.id || '', code, b.token || '', '').first<any>();
    if (!player) throw new GameError('Your device session has been released. Rejoin your class to continue.', 401);
    if (player.enabled === 0) throw new GameError('Your class is currently omitted. Please wait for the host.');
    if (player.enabled !== 1) throw new GameError('Join a class team before buzzing. Your earlier results are retained.');
    // The original ordering algorithm is unchanged: an atomic, one-buzz-per-student insert;
    // the first database-assigned id wins. Device clocks never decide the winner.
    await db.batch([
      run(`INSERT OR IGNORE INTO buzzes(room,round,player,at,response_ms) SELECT code,round,?,CAST(unixepoch('subsec')*1000 AS INTEGER),CASE WHEN started_at IS NULL THEN NULL ELSE MAX(0,CAST(unixepoch('subsec')*1000 AS INTEGER)-started_at) END FROM rooms WHERE code=? AND round=? AND armed=1 AND (time_limit=0 OR started_at+time_limit*1000>CAST(unixepoch('subsec')*1000 AS INTEGER)) AND (multiple_buzzes=1 OR NOT EXISTS(SELECT 1 FROM buzzes b WHERE b.room=rooms.code AND b.round=rooms.round)) AND EXISTS(SELECT 1 FROM players p LEFT JOIN teams t ON t.id=p.team WHERE p.id=? AND p.room=? AND p.token=? AND p.token!='' AND t.enabled=1)`, b.id, code, b.round, b.id, code, b.token || ''),
      run('UPDATE rooms SET armed=0 WHERE code=? AND round=? AND multiple_buzzes=0 AND EXISTS(SELECT 1 FROM buzzes b WHERE b.room=rooms.code AND b.round=rooms.round)', code, b.round),
    ]);
  }
  // One transaction makes every returned room, roster and buzz list a consistent snapshot.
  const state = await db.batch([
    run('SELECT code,title,round,round_count AS roundCount,question_count AS questionCount,time_limit AS timeLimit,competition_round AS competitionRound,question,phase,round_locked AS roundLocked,started_at AS startedAt,armed,multiple_buzzes AS multipleBuzzes,school_logo AS schoolLogo,competition_logo AS competitionLogo FROM rooms WHERE code=?', code),
    run('SELECT t.id,t.name,t.enabled,t.score,t.logo,t.sort,(SELECT AVG(b.response_ms) FROM buzzes b JOIN players p ON p.id=b.player WHERE b.room=t.room AND p.team=t.id) AS averageMs FROM teams t WHERE t.room=? ORDER BY t.sort', code),
    run(`SELECT p.id,p.name,p.score,p.team,p.seat,CASE WHEN p.token!='' THEN 1 ELSE 0 END AS joined,(SELECT AVG(b.response_ms) FROM buzzes b WHERE b.player=p.id AND b.room=p.room) AS averageMs FROM players p WHERE p.room=? ORDER BY p.team,p.seat,p.name`, code),
    run(`SELECT b.id,b.player,p.name,p.team,b.at,b.response_ms AS responseMs,b.verdict FROM buzzes b JOIN players p ON p.id=b.player WHERE b.room=? AND b.round=(SELECT round FROM rooms WHERE code=? AND (phase!='ready' OR competition_round=1)) ORDER BY b.id`, code, code),
  ]);
  return { ...(state[0].results[0] as Record<string, unknown>), teams: state[1].results, players: state[2].results, buzzes: state[3].results };
}
