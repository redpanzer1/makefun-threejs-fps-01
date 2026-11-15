// The game's state, in one place. Modules read and write this object; nothing
// else holds round, money or objective state. Events are a small queue the
// fixed step drains: a shot is heard by bots, a kill feeds the HUD and the
// score, a plant moves the round. The queue is reused, never reallocated.
export function createState() {
  return {
    phase: 'menu', // menu | buy | live | over
    round: 1,
    roundTime: 0,
    buyTime: 0,
    overTime: 0,
    overReason: '',
    overWon: false,
    time: 0,
    seed: 1,
    money: 800,
    kills: 0,
    headshots: 0,
    shotsFired: 0,
    shotsHit: 0,
    score: { won: 0, lost: 0 },
    bomb: {
      state: 'idle', // idle | carried | planted | defused | detonated
      site: null, // 'A' | 'B'
      x: 0,
      z: 0,
      plantProgress: 0,
      timer: 0,
      defuseProgress: 0,
      defuser: null,
    },
    events: [],
  };
}

export function pushEvent(state, event) {
  state.events.push(event);
}

export function drainEvents(state, fn) {
  for (let i = 0; i < state.events.length; i += 1) fn(state.events[i]);
  state.events.length = 0;
}
