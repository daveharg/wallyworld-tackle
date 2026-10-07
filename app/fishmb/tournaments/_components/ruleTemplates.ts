/** Preset rule templates for tournament organizers, based on how Manitoba
 *  catch-photo tournaments and derbies are commonly run. Organizers can pick
 *  one and edit it — the templates are a starting point, not legal advice. */

export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  rules: string;
}

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: "cpr-standard",
    name: "Catch-photo-release (standard)",
    description: "The classic Manitoba format — photo, measure, release.",
    rules: `1. ELIGIBILITY — Every angler must hold a valid Manitoba angling licence (or be exempt) and follow all Manitoba angling and boating regulations. Winners may be asked to show their licence before prizes are paid.

2. CATCH PHOTO — All entries are logged through FishMB with a photo taken in the app at the moment of capture. Photos from the camera roll or gallery are not accepted. Each photo is time, date and GPS stamped automatically.

3. MEASURING — Fish must be photographed on a flat bump board or measuring tape, nose against the bump/zero, tail pinched. The organizer's reading of the photo is final.

4. CATCH & RELEASE — This is a release tournament. Fish must be released alive and in releasable condition after the photo. Any angler found keeping a fish they entered will be disqualified.

5. ONE ACCOUNT PER ANGLER — Each angler registers and logs their own catches under their own account.

6. WINDOW & WATERS — Only fish caught inside the tournament dates and on the listed waters count. Catches are stamped when the picture is taken, not when they upload.

7. REVIEW — The organizer reviews every catch before it hits the leaderboard. Duplicate or suspicious photos will be rejected.

8. DISPUTES — The organizer's interpretation of these rules is final.`,
  },
  {
    id: "big-fish",
    name: "Big fish shootout",
    description: "One winner — the single longest fish takes the pot.",
    rules: `1. ELIGIBILITY — Valid Manitoba angling licence (or exemption) required; all provincial angling and boating regulations apply.

2. FORMAT — One winner: the single longest fish logged during the tournament window wins. Ties are broken by the earliest catch time.

3. CATCH PHOTO — Entries are logged through FishMB with a photo taken in the app at the moment of capture — no camera-roll uploads. Photos are time, date and GPS stamped.

4. MEASURING — Fish photographed flat on a bump board or tape, nose at zero, tail pinched. Organizer's reading is final.

5. CATCH & RELEASE — Release every fish alive after the photo. Keeping an entered fish means disqualification.

6. REVIEW — The organizer reviews every catch before it counts. The organizer's decision is final.`,
  },
  {
    id: "team",
    name: "Team tournament",
    description: "Fish as a team — best combined result wins.",
    rules: `1. ELIGIBILITY — Every team member must hold a valid Manitoba angling licence (or be exempt). All provincial angling and boating regulations apply.

2. TEAMS — Each team fishes together under one tournament entry. Decide your team name when you join.

3. CATCH PHOTO — Every scoring fish is logged through FishMB with a photo taken in the app at the moment of capture. No camera-roll uploads. Photos are time, date and GPS stamped.

4. MEASURING — Fish photographed flat on a bump board or tape, nose at zero, tail pinched. Organizer's reading is final.

5. CATCH & RELEASE — Release every fish alive after the photo. Keeping an entered fish disqualifies the team.

6. REVIEW — The organizer reviews every catch before it counts, and the organizer's decision is final.`,
  },
  {
    id: "ice-derby",
    name: "Ice fishing derby",
    description: "Hard-water rules — shelters, holes and cold-weather care.",
    rules: `1. ELIGIBILITY — Valid Manitoba angling licence (or exemption) required; all provincial angling regulations apply, including ice-fishing rules.

2. CATCH PHOTO — Entries are logged through FishMB with a photo taken in the app at the moment of capture — no camera-roll uploads. Photos are time, date and GPS stamped.

3. MEASURING — Fish photographed flat on a bump board or tape, nose at zero, tail pinched. Organizer's reading is final.

4. FISH CARE — Keep fish out of extreme cold only as long as the photo takes; release quickly. Frozen or injured fish will not be approved.

5. SAFETY — Anglers are responsible for checking ice conditions themselves. The organizer is not responsible for ice safety.

6. REVIEW — The organizer reviews every catch before it counts, and the organizer's decision is final.`,
  },
];
