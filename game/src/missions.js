// The story: six missions for the Solmar crew, told by fixer Rico Vane and
// finished at the Safehouse. Each mission is a list of objectives; an
// objective names what the player must do and where, and the world reports
// progress against it. Nothing here draws or reads input — it is data plus
// the small helpers that describe an objective in words.

export const MISSIONS = [
  {
    id: 1,
    title: 'First Wheels',
    giver: 'Rico Vane',
    brief: 'New in Solmar Bay, kid? Every legend here starts with a stolen car. Grab any parked car and bring it to my garage.',
    reward: 400,
    objectives: [
      { type: 'enterCar', text: 'Steal a car — press E next to a parked car' },
      { type: 'goto', x: 1150, y: 790, radius: 200, text: 'Drive to Rico’s Garage' },
    ],
  },
  {
    id: 2,
    title: 'The Pickup',
    giver: 'Rico Vane',
    brief: 'A crate washed up at the docks with my name on it. Pick it up, bring it back to the garage. Keep it quiet.',
    reward: 650,
    objectives: [
      { type: 'goto', x: 500, y: 2150, radius: 200, text: 'Go to the Docks' },
      { type: 'wait', seconds: 3, text: 'Grab the crate…' },
      { type: 'goto', x: 1150, y: 790, radius: 200, text: 'Deliver the crate to Rico’s Garage' },
    ],
  },
  {
    id: 3,
    title: 'Hot Delivery',
    giver: 'Lena Marlowe',
    brief: 'Marina Café needs the good stuff before the sunset crowd arrives. Seventy-five seconds, no excuses. Drive like the tide is chasing you.',
    reward: 900,
    objectives: [
      { type: 'goto', x: 3010, y: 1130, radius: 200, timeLimit: 75, text: 'Deliver to Marina Café — 75 seconds!' },
      { type: 'goto', x: 1150, y: 790, radius: 200, text: 'Report back to Rico’s Garage' },
    ],
  },
  {
    id: 4,
    title: 'Tail the Courier',
    giver: 'Rico Vane',
    brief: 'A courier is running my routes for a rival crew. Stay on his tail — get close and stay close, and he’ll crack. Don’t lose him.',
    reward: 1100,
    objectives: [
      { type: 'tail', seconds: 8, text: 'Tail the courier — stay within 160 px for 8 seconds' },
      { type: 'goto', x: 1150, y: 790, radius: 200, text: 'Return to Rico’s Garage' },
    ],
  },
  {
    id: 5,
    title: 'Dockside Trouble',
    giver: 'Lena Marlowe',
    brief: 'Rival goons are shaking down the dock workers. Go down there and make them regret it. Watch your back — they shoot first.',
    reward: 1500,
    objectives: [
      { type: 'goto', x: 500, y: 2150, radius: 200, text: 'Reach the Docks' },
      { type: 'kill', count: 4, text: 'Clear out the rival goons (0/4)' },
      { type: 'goto', x: 790, y: 2150, radius: 200, text: 'Meet Lena at the Safehouse', safehouse: true },
    ],
  },
  {
    id: 6,
    title: 'The Solmar Heist',
    giver: 'Rico Vane',
    brief: 'The big one. Solmar Bank, dusk, the vault open for exactly one crew: ours. Grab the cash, then lose the whole city. Bring it home, and you’re a legend.',
    reward: 5000,
    objectives: [
      { type: 'goto', x: 1870, y: 1470, radius: 200, text: 'Reach Solmar Bank' },
      { type: 'wait', seconds: 5, text: 'Crack the vault…' },
      { type: 'escape', text: 'Escape the police and reach the Safehouse!' },
    ],
  },
];

/** The story contact who gives the next mission, for the HUD and briefings. */
export function nextMission(index) {
  return MISSIONS[index] ?? null;
}

/** Short label for the mission tracker: "3/6 — Hot Delivery". */
export function missionLabel(index) {
  const mission = MISSIONS[index];
  if (!mission) return 'Story complete — free roam';
  return `${mission.id}/6 — ${mission.title}`;
}
