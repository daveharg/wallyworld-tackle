// Curated Fishing Tech Spotlight rotation for the server-side `tech`
// auto-post job (lib/fish/autopost-server.ts). Editorial content lives
// here, researched and approved in chat with Dave before it is added —
// the job itself never invents specs, prices, or videos.
//
// The job posts the first entry whose marker ("FISHING TECH SPOTLIGHT
// #<n>:") has never appeared in fm_discussions, at most one spotlight
// per 13 days on the scheduled (Thursday) runs. An admin Run now
// (force=1) may post the next one early; the never-posted check still
// makes a duplicate of the same spotlight impossible.
//
// Entries with body: null are coverage anchors: spotlights published
// before the server era (via the old VM script), kept so numbering and
// coverage stay durable. Never give an anchor a body.

export interface TechSpotlight {
  n: number;
  product: string;
  body: string | null;
}

export const TECH_SPOTLIGHTS: TechSpotlight[] = [
  {
    n: 1,
    product: "Garmin LiveScope 2",
    body: null, // Posted 2026-10-10 by the retired VM script job.
  },
  {
    n: 2,
    product: "ION Alpha Pro 8\" Electric Ice Auger",
    body: `🎣 FISHING TECH SPOTLIGHT #2: ION Alpha Pro 8" Electric Ice Auger

Big shoutout to Manitoba's own Jay Siemens. His first look at the brand new Alpha Pro is the best real world take we have seen on it, and it is linked below.

ION's new flagship for the 2026/27 season is built for exactly our kind of ice. The 8 inch Alpha Pro weighs just 14.3 lb, the lightest auger ION has made, and cuts at up to 3.8 inches per second. ION rates it at up to 2,000 inches of ice per charge on its 40V 4Ah battery. Do the Manitoba math on that: through 36 inches of Lake Winnipeg ice, that is roughly 55 holes on one battery, and about 10 seconds a hole.

Also in the kit: the Turbo cutting system on a composite bit that stays flexible in deep cold, a slush flushing reverse, LED drilling lights, a variable speed trigger, and a fast charger that refills the battery in 60 to 90 minutes. Warranty is 3 years on the whole unit, battery included.

Honest take: the runtime number is ION's own rating with no published test thickness, so real world holes per charge will vary with ice and cold, and like every lithium auger the battery should be kept warm between moves. The two battery version lists at $929.99 at Lake of the Woods Sports Headquarters in Kenora. It is not cheap. But at 14.3 lb, against 24 lb augers, your shoulders will know the difference by hole thirty.

Who is it for? Run and gun anglers who drill all day on big Manitoba water. If you fish one spot and sit, a heavier auger does the job for less.

🎥 Watch Jay Siemens put the Alpha Pro on the ice:
https://www.youtube.com/watch?v=QFbQj6ikFmU

What is everyone running this season, and how many holes do you drill in a day?`,
  },
];
