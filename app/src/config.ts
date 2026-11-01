/** seasonal switch: jack-o'-lanterns, cobwebs, fog, the Pumpkin King event boss and the opening banner */
export const HALLOWEEN = true
/** costume ids match ZeronShop on-chain ids; 7 is drop-only (Pumpkin King) */
export const COSTUMES: { id: number; name: string; look: string; scale?: number; blurb: string }[] = [
  { id: 0, name: 'Knight', look: 'art:knight', blurb: 'The default. Free forever.' },
  { id: 1, name: 'Rogue', look: 'elf_m_idle_anim', blurb: 'Light feet, green hood.' },
  { id: 2, name: 'Mage Robe', look: 'wizzard_m_idle_anim', blurb: 'Smells of old scrolls.' },
  { id: 3, name: 'Pumpkin Head', look: 'pumpkin_dude_idle_anim', blurb: 'Seasonal. Carved with care.' },
  { id: 4, name: 'Skeleton', look: 'skelet_idle_anim', blurb: 'All bones, no fear.' },
  { id: 5, name: 'Witch Hat', look: 'wizzard_f_idle_anim', blurb: 'Brim wide enough for two crows.' },
  { id: 6, name: 'Vampire Cape', look: 'doc_idle_anim', blurb: 'A high collar and a long night.' },
  { id: 7, name: "Pumpkin King's Crown", look: 'pumpkin_dude_idle_anim', scale: 1.3, blurb: 'Drop-only: defeat the Pumpkin King.' },
]

/** weapon ids match ZeronArmory on-chain ids. cd = cooldown in 50 ms ticks. Damage is capped per hit on bosses so nothing trivializes them. */
export const WEAPONS: { id: number; name: string; price: number; cd: number; ammo?: boolean; icon: string; blurb: string }[] = [
  { id: 0, name: 'Sword Slash', price: 0, cd: 90, icon: '🗡', blurb: 'Default special: a wide slash, 1.15× damage.' },
  { id: 1, name: 'Bow', price: 6, cd: 50, icon: '🏹', blurb: 'Quick ranged shot, never trades blows.' },
  { id: 2, name: 'Spear', price: 9, cd: 70, icon: '🔱', blurb: 'Long reach: interrupts a wind-up.' },
  { id: 3, name: 'Twin Daggers', price: 12, cd: 80, icon: '⚔', blurb: 'Three-hit combo.' },
  { id: 4, name: 'Fire Staff', price: 15, cd: 110, icon: '🔥', blurb: 'Sets the foe ablaze: damage over 5 s.' },
  { id: 5, name: 'Bazooka', price: 20, cd: 100, ammo: true, icon: '🚀', blurb: 'Slow rocket, big splash. 3 shots per refill.' },
  { id: 6, name: 'War Hammer', price: 25, cd: 140, icon: '🔨', blurb: 'Slow, heavy, stuns the foe.' },
  { id: 7, name: 'Pumpkin Launcher', price: 0, cd: 110, ammo: true, icon: '🎃', blurb: 'Halloween: lobbed pumpkins that burst and burn. Drops from the Pumpkin King only.' },
]
