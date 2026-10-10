import { LegalDoc } from "../_components/LegalDoc";
import BackArrow from "../_components/BackArrow";

export const metadata = {
  title: "Privacy Policy — FishMB",
  description: "How FishMB collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <>
      <BackArrow />
      <LegalDoc
      title="Privacy Policy"
      updated="October 8, 2026"
      intro="FishMB is a community, not a data business. We collect the minimum needed to run the app, we don't sell your personal information, and your private spots stay private. Here's exactly what happens with your data."
      sections={[
        {
          heading: "What we collect",
          body: (
            <>
              <p>
                <strong>Account info</strong> — when you sign in with Google, we
                receive your name, email address, and profile photo. That's how
                we know who you are in the community.
              </p>
              <p>
                <strong>Things you post</strong> — feed posts, catch logs,
                photos, videos, comments, lake notes, and your profile details.
                Public posts are visible to other members; friends-only posts to
                your friends.
              </p>
              <p>
                <strong>Location — only what you share.</strong> We record
                location only where you explicitly add it: a catch you tag, a
                spot you save, a trail you record. Your saved spots, routes, and
                lake notes are private to you and never shown to other anglers.
              </p>
              <p>
                <strong>Messages</strong> — direct and group messages are
                end-to-end encrypted. We store the encrypted messages so they
                can be delivered, but we cannot read their contents.
              </p>
              <p>
                <strong>Basic technical data</strong> — the boring stuff every
                app needs: login sessions, error logs, and aggregate usage so we
                can keep the lights on and fix bugs.
              </p>
            </>
          ),
        },
        {
          heading: "How we use it",
          body: (
            <>
              <p>We use your information to:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Run your account and the community feed.</li>
                <li>Show your catches, posts, and profile to other members as you've chosen to share them.</li>
                <li>Deliver your encrypted messages.</li>
                <li>Keep the app working, secure, and free of abuse.</li>
              </ul>
              <p>
                We don't use your data for third-party advertising profiles, and
                we don't sell it. Ever.
              </p>
            </>
          ),
        },
        {
          heading: "Photos & video",
          body: (
            <p>
              Photos you upload are stored on our hosting provider. Videos are
              processed and streamed by our video provider (Mux) so they play
              on any phone or computer — they convert the file format and serve
              it to viewers. Both providers only handle the files to deliver
              this service.
            </p>
          ),
        },
        {
          heading: "Who else touches your data",
          body: (
            <>
              <p>A short list of service providers that make FishMB work:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Google — sign-in only. We never see your Google password.</li>
                <li>Hosting & database providers — store the app's data securely.</li>
                <li>Mux — converts and streams videos you post.</li>
              </ul>
              <p>
                We share data with them only as needed to run the service, and
                we don't share it with advertisers or data brokers.
              </p>
            </>
          ),
        },
        {
          heading: "Children",
          body: (
            <p>
              FishMB is for anglers <strong>13 and older</strong>. We don't
              knowingly collect personal information from children under 13
              without a parent or guardian's involvement. If you believe a child
              under 13 has created an account, contact us and we'll remove it.
            </p>
          ),
        },
        {
          heading: "Your choices",
          body: (
            <>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Delete any post, photo, video, or comment you've made, any time.</li>
                <li>Keep spots, notes, and trails private — they already are by default.</li>
                <li>Delete your account from your profile settings. That removes your profile and takes your posts out of public view.</li>
              </ul>
              <p>
                To request a copy of your data or ask us to delete it, contact
                us — we'll sort it out.
              </p>
            </>
          ),
        },
        {
          heading: "How long we keep it",
          body: (
            <p>
              We keep your account data while your account exists. Delete your
              account and we remove your profile and take your content out of
              public view; backups may retain copies for a limited time before
              they're purged.
            </p>
          ),
        },
        {
          heading: "Security",
          body: (
            <p>
              We use encrypted connections, secure sign-in, and access controls
              on our systems. No system is perfect — if we ever discover a
              breach affecting your data, we'll tell you.
            </p>
          ),
        },
        {
          heading: "Changes to this policy",
          body: (
            <p>
              If we change this policy in a meaningful way, we'll post the new
              version here with a new date and note the change. Continuing to
              use FishMB after that means you accept it.
            </p>
          ),
        },
      ]}
    />
    </>
  );
}
