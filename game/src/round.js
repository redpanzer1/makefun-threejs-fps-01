// The round machine: buy phase, live round, round-over banner, next round.
// Money is the tactics layer: win $3,250, loss $1,900, kill $300, plant
// $300. Dying loses bought weapons (weapons.dropBought). The bomb decides
// rounds after the timer: a planted bomb plays on until it blows or is
// defused; an unplanted bomb means the attackers lose on time.
import { MAP } from './map.js';
import { WEAPONS, FRAG_PRICE, ARMOR_PRICE } from './weapons.js';

const BUY_TIME = 15;
const ROUND_TIME = 100;
const OVER_TIME = 5;
const WIN_MONEY = 3250;
const LOSE_MONEY = 1900;
const KILL_MONEY = 300;
const PLANT_MONEY = 300;

export function createRound(state, player, weapons, bots, bomb) {
  function startRound() {
    state.phase = 'buy';
    state.buyTime = BUY_TIME;
    state.roundTime = ROUND_TIME;
    state.overTime = 0;
    state.overReason = '';
    bomb.reset();
    state.bomb.state = 'carried';
    bots.reset();
    player.reset(MAP.playerSpawn);
    weapons.refillOnRound();
  }

  function nextRound() {
    state.round += 1;
    startRound();
  }

  function endRound(won, reason) {
    if (state.phase === 'over') return;
    state.phase = 'over';
    state.overTime = OVER_TIME;
    state.overWon = won;
    state.overReason = reason;
    if (won) {
      state.score.won += 1;
      state.money += WIN_MONEY;
    } else {
      state.score.lost += 1;
      state.money += LOSE_MONEY;
    }
  }

  function buy(id) {
    if (state.phase !== 'buy') return false;
    if (id === 'frag') {
      if (weapons.frags() >= 3 || state.money < FRAG_PRICE) return false;
      state.money -= FRAG_PRICE;
      weapons.addFrag();
      return true;
    }
    if (id === 'armor') {
      if (player.state.armor >= 100 || state.money < ARMOR_PRICE) return false;
      state.money -= ARMOR_PRICE;
      player.state.armor = 100;
      return true;
    }
    const def = WEAPONS[id];
    if (!def || weapons.owned(id) || state.money < def.price) return false;
    state.money -= def.price;
    weapons.buy(id);
    return true;
  }

  function step(dt) {
    if (state.phase === 'buy') {
      state.buyTime -= dt;
      if (state.buyTime <= 0) {
        state.phase = 'live';
        state.roundTime = ROUND_TIME;
      }
      return;
    }
    if (state.phase === 'live') {
      const bombPlanted = state.bomb.state === 'planted';
      if (!bombPlanted) state.roundTime -= dt;
      if (bots.aliveCount() === 0) {
        endRound(true, bombPlanted ? 'Site cleared — bomb detonates' : 'All defenders eliminated');
      } else if (state.bomb.state === 'detonated') {
        endRound(true, 'Bomb detonated — site destroyed');
      } else if (player.state.health <= 0) {
        endRound(false, 'You were eliminated');
      } else if (state.bomb.state === 'defused') {
        endRound(false, 'Bomb defused by the Jackals');
      } else if (state.roundTime <= 0 && !bombPlanted) {
        endRound(false, 'Time expired — bomb not planted');
      }
      return;
    }
    if (state.phase === 'over') {
      state.overTime -= dt;
      if (state.overTime <= 0) nextRound();
    }
  }

  return {
    startRound,
    endRound,
    buy,
    step,
    killReward() {
      state.money += KILL_MONEY;
    },
    plantReward() {
      state.money += PLANT_MONEY;
    },
  };
}
