import { LegalDoc } from "../_components/LegalDoc";
import BackArrow from "../_components/BackArrow";

export const metadata = {
  title: "Terms of Service — FishMB",
  description: "The rules of the dock: FishMB's terms of service for Manitoba anglers.",
};

export default function TermsPage() {
  return (
    <>
      <BackArrow />
      <LegalDoc
      title="Terms of Service"
      updated="October 8, 2026"
      intro="Welcome to FishMB — Manitoba's fishing community. These terms are the rules of the dock: by creating an account or using the app, you agree to them. If you don't agree, don't use FishMB."
      sections={[
        {
          heading: "Who can use FishMB",
          body: (
            <>
              <p>
                You must be <strong>13 years of age or older</strong> to create an
                account. If you're under 13, a parent or guardian needs to create
                and manage the account for you — this follows Canada's privacy
                guidance for young people's personal information.
              </p>
              <p>
                FishMB is built for Manitoba anglers, but anglers anywhere are
                welcome. Wherever you fish, you follow your own local fishing
                laws.
              </p>
            </>
          ),
        },
        {
          heading: "Your account",
          body: (
            <>
              <p>
                You sign in with your Google account. Keep it secure — you're
                responsible for anything posted from it. One account per person;
                don't share it, sell it, or pretend to be someone else.
              </p>
              <p>
                Pick a decent display name. Impersonating another angler, guide,
                or business will get the account removed.
              </p>
            </>
          ),
        },
        {
          heading: "Your content",
          body: (
            <>
              <p>
                You own your posts, photos, videos, comments, and lake notes. By
                posting them on FishMB you give us permission to display them in
                the app and feed — that's how a community feed works. We don't
                sell your content, and this permission ends if you delete the
                content or your account (copies other anglers saved or shared
                may live on).
              </p>
              <p>
                Post only what you have the right to share. Don't upload someone
                else's photos or videos as your own.
              </p>
            </>
          ),
        },
        {
          heading: "Community rules",
          body: (
            <>
              <p>The dock is friendly. Don't ruin it:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>No harassment, hate speech, threats, or bullying — on the feed, in comments, or in messages.</li>
                <li>No spam, scams, or misleading posts (fake catches, fake tournaments).</li>
                <li>No illegal activity, including poaching or encouraging regulation violations.</li>
                <li>No sexual content involving minors, ever. We report it.</li>
                <li>Respect other anglers' privacy — don't post someone's secret spot or personal details without permission.</li>
              </ul>
              <p>
                Breaking these rules can get your content removed or your account
                suspended, with or without warning depending on severity.
              </p>
            </>
          ),
        },
        {
          heading: "Photos, video & location",
          body: (
            <>
              <p>
                Photos and videos you attach to posts are processed and streamed
                by our video provider so they play on any device. Location is
                only attached to catches, spots, or trails <em>you</em> choose
                to tag — your saved spots and lake notes stay private to you and
                are never shown to other anglers.
              </p>
              <p>
                Think before you post a location publicly: anything you put in a
                public post can be seen by every member.
              </p>
            </>
          ),
        },
        {
          heading: "Messages",
          body: (
            <p>
              Direct and group messages are end-to-end encrypted — not even
              FishMB can read them. The community rules still apply: if someone
              reports abusive messages, we can act on the report, including
              suspending accounts.
            </p>
          ),
        },
        {
          heading: "Tournaments",
          body: (
            <>
              <p>
                Tournaments on FishMB are organized and run by their organizers,
                not by FishMB. <strong>FishMB never handles entry fees or prize
                money</strong> — any money changes hands directly between
                organizers and anglers, at their own risk.
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Events with 25 or more anglers need Manitoba's free Competitive Fishing Event licence — organizers must arrange it.</li>
                <li>Real-money events require fresh, camera-only catch photos; the phone's capture timestamp is the official time.</li>
                <li>Our anti-cheat checks are review flags for organizers, not automatic judgments.</li>
              </ul>
              <p>
                If you run a tournament, you're responsible for its rules, its
                payouts, and following Manitoba law. If you enter one, you accept
                the organizer's rules.
              </p>
            </>
          ),
        },
        {
          heading: "Fishing information is a guide, not gospel",
          body: (
            <>
              <p>
                Our lake directory, regulations summaries, and community tips
                are built to help, but they can be wrong or out of date.{" "}
                <strong>Always check Manitoba's official fishing regulations
                before you fish.</strong> You're responsible for knowing the
                rules on the water you're on.
              </p>
              <p>
                Fishing has real risks — weather, water, ice. Fish at your own
                risk, wear a life jacket, and never trust early ice. FishMB isn't
                liable for what happens on your trip.
              </p>
            </>
          ),
        },
        {
          heading: "Businesses & ads",
          body: (
            <p>
              Lodges, guides, and shops can claim business pages and advertise.
              Ads are labelled. FishMB doesn't endorse advertisers — do your own
              homework before booking.
            </p>
          ),
        },
        {
          heading: "Suspension & termination",
          body: (
            <p>
              We can suspend or remove accounts that break these terms, with or
              without warning. You can delete your account any time from your
              profile settings — that removes your profile and posts from public
              view.
            </p>
          ),
        },
        {
          heading: "The fine print",
          body: (
            <>
              <p>
                FishMB is provided "as is", without warranties. To the extent the
                law allows, we aren't liable for indirect or consequential
                damages from using the app.
              </p>
              <p>
                These terms are governed by the laws of Manitoba and Canada. If
                we update them, we'll post the new version here with a new date
                — continuing to use FishMB after that means you accept the
                changes.
              </p>
            </>
          ),
        },
      ]}
    />
    </>
  );
}
