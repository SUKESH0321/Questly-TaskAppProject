/**
 * DEV ONLY. Wipes every task, application, payment, conversation, message and
 * task/message notification, then fills the database with realistic sample
 * content (tasks in every category and every lifecycle state, with chats).
 * Accounts are never touched.
 *
 *   npm run seed:demo -- --yes [--backup <folder>]
 *
 * Safety: needs --yes, and refuses to run unless MONGODB_URI points at localhost
 * (pass --allow-remote only if you really mean it).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const arg = (f: string) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/questly";
const host = new URL(uri.replace("mongodb+srv://", "mongodb://")).hostname;
const isLocal = ["localhost", "127.0.0.1", "::1"].includes(host);

if (!has("--yes")) {
  console.error("This DELETES all tasks, chats and payments. Re-run with --yes to confirm.");
  process.exit(1);
}
if (!isLocal && !has("--allow-remote")) {
  console.error(`Refusing to run: the database host is "${host}", not localhost. Use --allow-remote only if you are sure.`);
  process.exit(1);
}

const { ObjectId } = mongoose.Types;
const now = Date.now();
const MIN = 60_000;
const ago = (minutes: number) => new Date(now - minutes * MIN);
const iso = (d: Date) => d.toISOString();
const dayStr = (offset: number) => new Date(now + offset * 86_400_000).toISOString().split("T")[0];

type Who = "w" | "p";
type Line = [Who, string];

// ---------- Conversation lines per category ({p} = poster first name, {w} = tasker first name) ----------
const CHAT: Record<string, { talk: Line[]; done: Line[] }> = {
  Cleaning: {
    talk: [
      ["w", "Hi {p}! I can take this on. I bring my own vacuum, mop and supplies, so you don't need to arrange anything."],
      ["p", "Great, thanks {w}. The flat is around 1,100 sq ft. Are the balcony and windows included?"],
      ["w", "Yes, balcony and inside window panes are included. Grills would be ₹150 extra if you want them done."],
      ["p", "Add the grills too. Can you start at 9 sharp?"],
      ["w", "9 sharp works. I'll message you when I'm downstairs."],
    ],
    done: [
      ["w", "All done! I've sent photos of the kitchen and both bathrooms."],
      ["p", "Looks spotless. Releasing the payment now, thank you {w}!"],
    ],
  },
  Repairs: {
    talk: [
      ["w", "Hi {p}, I handle fan and hinge repairs all the time. Could you send a short video of the problem?"],
      ["p", "Sending a clip now. It starts grinding after about a minute on high speed."],
      ["w", "Sounds like a worn bearing. I'll carry a spare and a capacitor, so it should be a one-visit job."],
      ["p", "Perfect. Is tomorrow morning okay?"],
      ["w", "Yes, between 10 and 11. I'll confirm in the morning."],
    ],
    done: [
      ["w", "Replaced the bearing and tightened the blades. It runs silently now."],
      ["p", "Brilliant, so quiet. Releasing payment, thanks!"],
    ],
  },
  Moving: {
    talk: [
      ["w", "Hello {p}, I have a helper and a tempo for a shift this size. When do you want to start?"],
      ["p", "Sunday around 10. First floor, no lift needed, but the sofa is heavy."],
      ["w", "No problem. We bring straps and blankets so nothing gets scratched."],
      ["p", "Great. It's about 4 km, to BTM 2nd Stage."],
      ["w", "Easy. We'll be there at 10 sharp."],
    ],
    done: [
      ["w", "Everything is at the new flat and placed where you wanted. Please check the sofa corner."],
      ["p", "All perfect, no scratches. Releasing the payment. Thank you both!"],
    ],
  },
  Delivery: {
    talk: [
      ["w", "Hi {p}, I'm nearby on a bike and can pick this up right away. Where exactly do I collect it?"],
      ["p", "Third floor, 100 Feet Road. Ask at the front desk, the envelope has my name."],
      ["w", "On my way, ten minutes. I'll send a photo once I have it."],
      ["w", "Picked up! Heading to the drop point now."],
      ["p", "Thank you, super quick."],
    ],
    done: [],
  },
  Tutoring: {
    talk: [
      ["w", "Hello {p}, I've tutored Class 10 maths for three years, with a focus on algebra and geometry."],
      ["p", "That's exactly what we need. He struggles with quadratic equations and triangles."],
      ["w", "I can start with a free 30 minute diagnostic so I know where the gaps are. Evenings 6 to 7 suit me."],
      ["p", "Evenings are good. Can we try Tuesday, Thursday and Saturday?"],
      ["w", "Works for me. I'll share a short worksheet before the first session."],
    ],
    done: [],
  },
  Plumbing: {
    talk: [
      ["w", "Hi {p}, I can come today. Is the leak at the tap joint or under the sink pipe?"],
      ["p", "It drips where the pipe meets the tap, and the cabinet floor is wet."],
      ["w", "Likely a worn washer or a loose connector. I'll bring both and some Teflon tape."],
      ["p", "Please come after 5, I'm home then."],
      ["w", "Done, I'll reach by 5:15."],
    ],
    done: [
      ["w", "Replaced the faulty part and fixed the leak. Tested three times, no drip."],
      ["p", "Thanks {w}, works perfectly. Payment released."],
    ],
  },
  "Furniture Assembly": {
    talk: [
      ["w", "Hi {p}, I've assembled many of these. Do you have all the panels and the instruction booklet?"],
      ["p", "Yes, everything is in the boxes, plus the extra hinges pack."],
      ["w", "Then it takes about two and a half hours. I bring my own drill and a rubber mallet."],
      ["p", "Great. Saturday at 2 works?"],
      ["w", "Saturday 2 PM, confirmed."],
    ],
    done: [
      ["w", "Everything is assembled and tightened. Please give it a wiggle test."],
      ["p", "Rock solid! Thanks {w}."],
    ],
  },
  Gardening: {
    talk: [
      ["w", "Hello {p}, I love balcony gardens. Which direction does it face? That decides what will thrive."],
      ["p", "West facing, with strong afternoon sun."],
      ["w", "Good for herbs, chillies and succulents. I'll bring soil mix, pots and a simple watering schedule."],
      ["p", "Lovely. Can you also tell me how often to water?"],
      ["w", "Of course, I'll write it on a small card for you."],
    ],
    done: [],
  },
  Other: {
    talk: [
      ["w", "Hi {p}, I'm free that morning and can queue for you. Which office, and when does the token window open?"],
      ["p", "RTO Indiranagar, the window opens at 8. I only need a token number and a photo of the slip."],
      ["w", "I'll be there by 7:15 and send you the token as soon as I have it."],
      ["p", "Thank you, that saves me a lot of time."],
    ],
    done: [],
  },
};

// ---------- Task specs ----------
interface Spec {
  cat: string;
  title: string;
  desc: string;
  budget: number;
  loc: string;
  timeLabel: string;
  dayOffset: number;
  poster: string;
  status: "open" | "in_progress" | "completed" | "expired";
  worker?: string;
  applicants?: string[]; // pending applicants (open) -- the accepted worker is added automatically
  windowMin?: number; // search window; open tasks only
  createdAgoMin: number;
  pay?: "held" | "released";
  workerDone?: boolean;
  img?: string;
  talk?: Line[];
  done?: Line[];
  note?: Record<string, string>; // application message per applicant key
}

const U = (id: string) => `https://images.unsplash.com/photo-${id}?q=80&w=600&auto=format&fit=crop`;

const SPECS: Spec[] = [
  // Cleaning
  { cat: "Cleaning", title: "Deep clean 2BHK before house-warming", desc: "Full deep clean of a 2BHK: kitchen, both bathrooms, balcony and floors. We are hosting guests on Sunday, so it needs to be spotless.", budget: 1800, loc: "HSR Layout, Bengaluru", timeLabel: "Sat, 9:00 AM", dayOffset: 2, poster: "anne", status: "open", windowMin: 180, createdAgoMin: 55, applicants: ["sarah", "jim"], img: U("1581578731548-c64695cc6952"), note: { sarah: "Hi! I run a small cleaning crew and have done 40+ deep cleans. Happy to bring all supplies.", jim: "Available Saturday morning. I can finish in about 4 hours." } },
  { cat: "Cleaning", title: "Bathroom and kitchen scrub", desc: "Two bathrooms and the kitchen slab need a proper scrub, including tiles and exhaust fan.", budget: 650, loc: "Indiranagar, Bengaluru", timeLabel: "Today, 5:00 PM", dayOffset: -6, poster: "emmanuel", status: "completed", worker: "michael", createdAgoMin: 6 * 1440 + 200, pay: "released" },
  // Repairs
  { cat: "Repairs", title: "Ceiling fan making a grinding noise", desc: "The bedroom ceiling fan grinds after a minute on high speed. Probably the bearing. I can send a video.", budget: 400, loc: "Koramangala, Bengaluru", timeLabel: "Tomorrow morning", dayOffset: 1, poster: "sadie", status: "open", createdAgoMin: 190, applicants: ["batman"], note: { batman: "I fix fans and small appliances. Can come tomorrow between 10 and 11." } },
  { cat: "Repairs", title: "Fix wobbly wardrobe door hinge", desc: "Left door of the wardrobe sags and won't close properly. Needs a new hinge or re-fitting.", budget: 350, loc: "JP Nagar, Bengaluru", timeLabel: "Yesterday, 6:00 PM", dayOffset: -1, poster: "design", status: "in_progress", worker: "jim", createdAgoMin: 1700, pay: "held", talk: [["w", "Hi Design, I can fix that hinge today. Do you have a spare, or should I bring one?"], ["p", "No spare. Please bring one, I'll pay for it separately."], ["w", "Will do. Hinges are about ₹60, I'll show you the bill."], ["p", "Perfect, payment is secured in escrow so you can go ahead."], ["w", "Thanks, starting tomorrow evening as agreed."]] },
  { cat: "Repairs", title: "Set up a Wi-Fi mesh across three rooms", desc: "New mesh pair to be placed with the ISP router. Want full coverage in all three bedrooms.", budget: 800, loc: "Whitefield, Bengaluru", timeLabel: "Thu, 7:00 PM", dayOffset: -4, poster: "emmanuel", status: "completed", worker: "design", createdAgoMin: 4 * 1440 + 400, pay: "released", talk: [["w", "Hi Emmanuel, I've set up mesh Wi-Fi in many flats. Which router, and how many rooms?"], ["p", "Three bedrooms, ISP router plus a new mesh pair."], ["w", "I'll place the nodes for the best coverage and test speeds in each room."], ["p", "Thursday evening works."]], done: [["w", "All set. 80+ Mbps in every room, and I left the credentials on a note."], ["p", "Great job, releasing the payment."]] },
  { cat: "Repairs", title: "Mount a 55-inch TV on a brick wall", desc: "55 inch TV, plain brick wall. Bracket is already bought, I just need it mounted and the cables hidden.", budget: 600, loc: "Koramangala, Bengaluru", timeLabel: "Last Sunday", dayOffset: -9, poster: "sadie", status: "completed", worker: "design", createdAgoMin: 9 * 1440 + 100, pay: "released", talk: [["w", "Hi Sadie, I'll bring a stud finder and a drill. What size is the TV and what's the wall made of?"], ["p", "55 inch, plain brick wall."], ["w", "Brick is easy, I'll use proper anchors."], ["p", "Great, Sunday works."]], done: [["w", "Mounted and levelled, cables hidden behind the panel."], ["p", "Perfect, thank you!"]] },
  // Moving
  { cat: "Moving", title: "Help move a sofa and 12 boxes (1st floor)", desc: "Moving within the area, about 4 km. One sofa, a dining table and around 12 boxes. No lift needed.", budget: 1200, loc: "BTM Layout, Bengaluru", timeLabel: "Sun, 10:00 AM", dayOffset: 3, poster: "zendaya", status: "open", windowMin: 60, createdAgoMin: 38, applicants: ["batman", "michael"], note: { batman: "I have a helper and a tempo. We can do it in 2 trips.", michael: "Available Sunday. I'll bring straps and blankets." } },
  { cat: "Moving", title: "Pack and shift a studio flat", desc: "Studio flat, fragile kitchenware included. Needs packing material and a small truck.", budget: 3500, loc: "Whitefield, Bengaluru", timeLabel: "Last weekend", dayOffset: -8, poster: "anne", status: "completed", worker: "batman", createdAgoMin: 8 * 1440 + 90, pay: "released" },
  // Delivery
  { cat: "Delivery", title: "Pick up documents, drop at MG Road", desc: "One envelope from Indiranagar to an office on MG Road. Needs to reach before 4 PM.", budget: 180, loc: "Indiranagar to MG Road", timeLabel: "Within 2 hours", dayOffset: 0, poster: "emmanuel", status: "open", windowMin: 30, createdAgoMin: 19 },
  { cat: "Delivery", title: "Deliver a birthday cake before 6 PM", desc: "Cake from a Jayanagar bakery to Koramangala. Handle with care, it is a tall cake.", budget: 250, loc: "Jayanagar to Koramangala", timeLabel: "Yesterday, 4:00 PM", dayOffset: -1, poster: "design", status: "expired", windowMin: 30, createdAgoMin: 135 },
  // Tutoring
  { cat: "Tutoring", title: "Class 10 maths tutor, 3 evenings a week", desc: "Looking for a patient tutor for my son. Focus on algebra and geometry, with a weekly test. ₹6,000 per month.", budget: 6000, loc: "Marathahalli, Bengaluru", timeLabel: "Weekly, evenings", dayOffset: 2, poster: "sadie", status: "open", createdAgoMin: 1200, applicants: ["sarah", "michael"], note: { sarah: "I've tutored Class 10 for three years and can share references.", michael: "Maths postgraduate here. Happy to do a free trial class." } },
  { cat: "Tutoring", title: "Help with a Python assignment (loops and functions)", desc: "Stuck on pattern printing and a few functions questions. A one-hour screen-share session would be perfect.", budget: 500, loc: "Online", timeLabel: "Tonight, 8:00 PM", dayOffset: 0, poster: "zendaya", status: "in_progress", worker: "design", createdAgoMin: 300, pay: "held", workerDone: true, talk: [["w", "Hi Zendaya, happy to help with the Python assignment. Which topics are you stuck on?"], ["p", "Loops and functions mostly. I can't get the pattern printing question right."], ["w", "That's a classic. Let's do a 45 minute screen-share and I'll walk through it with your code."], ["p", "Please. Tonight at 8?"], ["w", "8 works. Send me the question paper before that."]], done: [["w", "Finished. I've added comments to your code so you can follow the logic."], ["p", "Got it, loops finally make sense!"]] },
  // Plumbing
  { cat: "Plumbing", title: "Kitchen tap leaking under the sink", desc: "Tap drips at the joint and the cabinet floor stays wet. Needs a washer or connector replaced.", budget: 450, loc: "Malleshwaram, Bengaluru", timeLabel: "ASAP", dayOffset: 0, poster: "design", status: "open", windowMin: 60, createdAgoMin: 19, applicants: ["jim", "michael"], img: U("1607472586893-edb57cb640d2"), note: { jim: "Plumber with 8 years of experience. Can reach within an hour.", michael: "Nearby right now, I carry washers and connectors." } },
  { cat: "Plumbing", title: "Replace flush tank fittings", desc: "Flush tank keeps running. Needs the valve and float replaced.", budget: 700, loc: "Whitefield, Bengaluru", timeLabel: "Last Friday", dayOffset: -7, poster: "emmanuel", status: "completed", worker: "jim", createdAgoMin: 7 * 1440 + 60, pay: "released" },
  // Furniture Assembly
  { cat: "Furniture Assembly", title: "Assemble a 2-door PAX wardrobe", desc: "All panels, hinges and the booklet are ready. Needs careful assembly and wall anchoring.", budget: 1500, loc: "Koramangala, Bengaluru", timeLabel: "Sat, 2:00 PM", dayOffset: 2, poster: "anne", status: "open", createdAgoMin: 600, applicants: ["michael"], img: U("1595514535415-3bdc1b4d081e"), note: { michael: "I've assembled over 50 wardrobes. I bring my own drill." } },
  { cat: "Furniture Assembly", title: "Put together a study desk and chair", desc: "Flat-pack desk with drawers plus an ergonomic chair. Instructions included.", budget: 600, loc: "HSR Layout, Bengaluru", timeLabel: "Tomorrow, 11:00 AM", dayOffset: 1, poster: "sadie", status: "in_progress", worker: "michael", createdAgoMin: 900 },
  // Gardening
  { cat: "Gardening", title: "Balcony garden setup: 10 pots and a watering plan", desc: "West-facing balcony with strong afternoon sun. Want herbs, chillies and a few succulents, plus a simple watering routine.", budget: 900, loc: "JP Nagar, Bengaluru", timeLabel: "Next Saturday", dayOffset: 5, poster: "zendaya", status: "open", createdAgoMin: 2400, applicants: ["sarah"], note: { sarah: "I love balcony gardens! I bring soil mix and pots and leave you a watering card." } },
  { cat: "Gardening", title: "Trim the hedge and clear the back garden", desc: "Overgrown hedge along the boundary and some fallen branches to clear and bag up.", budget: 1100, loc: "Jayanagar, Bengaluru", timeLabel: "This weekend", dayOffset: 3, poster: "emmanuel", status: "open", createdAgoMin: 300 },
  // Other
  { cat: "Other", title: "Queue at the RTO for a token (morning slot)", desc: "I only need someone to stand in line and send me the token number plus a photo of the slip.", budget: 500, loc: "RTO Indiranagar", timeLabel: "Mon, 7:15 AM", dayOffset: 3, poster: "anne", status: "open", createdAgoMin: 420, applicants: ["batman"], note: { batman: "Free on Monday morning, I'll be there by 7:15." } },
  { cat: "Other", title: "Photograph a small birthday party (2 hours)", desc: "Niece's 5th birthday, about 15 guests. Candid shots and the cake cutting. 40 edited photos within two days.", budget: 2500, loc: "Indiranagar, Bengaluru", timeLabel: "Last Saturday", dayOffset: -5, poster: "design", status: "completed", worker: "sadie", createdAgoMin: 5 * 1440 + 300, pay: "released", talk: [["w", "Hi Design, I shoot candid party photos with a mirrorless camera. I'll deliver 40 edited pictures within two days."], ["p", "Lovely. It's a small birthday for my niece, around 15 people."], ["w", "Perfect size. I'll arrive 15 minutes early to catch the setup."]], done: [["w", "Gallery link sent. I picked the best 45."], ["p", "These are beautiful, thank you!"]] },
];

const NAMES: Record<string, string> = {
  sadie: "Sadie Sink", emmanuel: "Emmanuel Hunt", zendaya: "Zendaya Holland", anne: "Anne Hathaway", design: "Design Review",
  sarah: "Sarah Jenkins", michael: "Michael Chen", jim: "Jim Halpert", batman: "Batman",
};

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection;

  // Resolve accounts by name.
  const userDocs = await db.collection("users").find({}).toArray();
  const user: Record<string, any> = {};
  for (const [key, name] of Object.entries(NAMES)) {
    const u = userDocs.find((d) => d.name === name);
    if (!u) throw new Error(`Account "${name}" not found. This script expects the accounts listed in NAMES.`);
    user[key] = u;
  }

  // ---------- Backup ----------
  const backupDir = arg("--backup");
  if (backupDir) {
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const out: Record<string, unknown[]> = {};
    for (const c of ["tasks", "applications", "payments", "conversations", "messages", "notifications"]) {
      out[c] = await db.collection(c).find({}).toArray();
    }
    const file = path.join(backupDir, `questly-content-backup-${stamp}.json`);
    fs.writeFileSync(file, (mongoose.mongo as any).BSON.EJSON.stringify(out, undefined, 1, { relaxed: false }));
    console.log("Backup written:", file, Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])));
  }

  // ---------- Wipe ----------
  const wiped = {
    tasks: (await db.collection("tasks").deleteMany({})).deletedCount,
    applications: (await db.collection("applications").deleteMany({})).deletedCount,
    payments: (await db.collection("payments").deleteMany({})).deletedCount,
    conversations: (await db.collection("conversations").deleteMany({})).deletedCount,
    messages: (await db.collection("messages").deleteMany({})).deletedCount,
    notifications: (await db.collection("notifications").deleteMany({ type: { $ne: "system" } })).deletedCount,
  };
  console.log("Deleted:", wiped);

  // ---------- Build ----------
  const tasks: any[] = [], applications: any[] = [], payments: any[] = [], notifications: any[] = [];
  const convos = new Map<string, { a: string; b: string; msgs: { from: string; text: string; at: Date }[] }>();
  const pairKey = (x: string, y: string) => [x, y].sort().join("|");
  const first = (k: string) => NAMES[k].split(" ")[0];

  const addMessages = (posterKey: string, workerKey: string, lines: Line[], start: Date, spanMin: number) => {
    const key = pairKey(posterKey, workerKey);
    const c = convos.get(key) ?? { a: posterKey, b: workerKey, msgs: [] };
    convos.set(key, c);
    const gaps = [0, 3, 6, 19, 22, 27, 31, 40];
    const maxAvail = Math.max(1, (now - start.getTime()) / MIN - 1);
    const scale = Math.min(1, maxAvail / Math.max(1, gaps[Math.min(lines.length, gaps.length) - 1]));
    lines.forEach(([who, text], i) => {
      const at = new Date(start.getTime() + (gaps[Math.min(i, gaps.length - 1)] + Math.floor(i / gaps.length) * 15) * MIN * scale);
      const fromKey = who === "w" ? workerKey : posterKey;
      c.msgs.push({ from: fromKey, text: text.replace(/\{p\}/g, first(posterKey)).replace(/\{w\}/g, first(workerKey)), at });
    });
    void spanMin;
  };

  SPECS.forEach((s, i) => {
    const _id = new ObjectId();
    const createdAt = ago(s.createdAgoMin);
    const poster = user[s.poster];
    const worker = s.worker ? user[s.worker] : null;
    const expiresAt = s.status === "open" && s.windowMin ? new Date(createdAt.getTime() + s.windowMin * MIN) : null;
    const expiredAt = s.status === "expired" ? new Date(createdAt.getTime() + (s.windowMin ?? 30) * MIN) : null;
    const completedAt = s.status === "completed" ? new Date(now - Math.max(60, s.createdAgoMin - 1440) * MIN) : null;

    tasks.push({
      _id, title: s.title, description: s.desc, category: s.cat, budget: s.budget, rating: 0,
      location: s.loc, distance: "", time: s.timeLabel, date: dayStr(s.dayOffset), imageUrl: s.img ?? "",
      status: s.status, posterId: poster._id, posterName: poster.name, posterAvatar: "", posterRating: poster.rating ?? 5,
      workerId: worker ? worker._id : null, workerName: worker ? worker.name : "", workerMarkedDone: !!(s.workerDone || s.status === "completed"),
      expiresAt, expiredAt, createdAt, updatedAt: completedAt ?? expiredAt ?? createdAt, __v: 0,
    });

    // Applications (pending applicants + the accepted worker).
    const appliedBase = new Date(createdAt.getTime() + Math.min(18, Math.max(2, (now - createdAt.getTime()) / MIN / 3)) * MIN);
    const pending = s.applicants ?? [];
    pending.forEach((k, j) => {
      const u = user[k];
      const at = new Date(appliedBase.getTime() + j * 7 * MIN);
      applications.push({ _id: new ObjectId(), taskId: _id, applicantId: u._id, applicantName: u.name, applicantAvatar: "", applicantRating: u.rating ?? 5, message: s.note?.[k] ?? "", status: "pending", createdAt: at, updatedAt: at, __v: 0 });
      notifications.push({ _id: new ObjectId(), userId: poster._id, type: "application", title: "New application", description: `${u.name} applied for "${s.title}"`, time: "", link: `/tasks/${_id}`, read: (now - at.getTime()) > 6 * 3600_000, createdAt: at, updatedAt: at, __v: 0 });
      // The first applicant has a full conversation; later ones are still early in the
      // process (their application note, then a holding reply), so threads differ.
      const lines: Line[] =
        j === 0
          ? CHAT[s.cat].talk
          : [
              ["w", s.note?.[k] ?? CHAT[s.cat].talk[0][1]],
              ["p", "Thanks {w}! I'll go through all the applications and get back to you shortly."],
            ];
      addMessages(s.poster, k, lines, new Date(at.getTime() + 2 * MIN), 40);
    });
    if (worker && s.worker) {
      applications.push({ _id: new ObjectId(), taskId: _id, applicantId: worker._id, applicantName: worker.name, applicantAvatar: "", applicantRating: worker.rating ?? 5, message: "", status: "accepted", createdAt: appliedBase, updatedAt: appliedBase, __v: 0 });
      addMessages(s.poster, s.worker, s.talk ?? CHAT[s.cat].talk, new Date(appliedBase.getTime() + 2 * MIN), 40);
      const acceptedAt = new Date(appliedBase.getTime() + 45 * MIN);
      notifications.push({ _id: new ObjectId(), userId: worker._id, type: "status", title: "You got the task!", description: `${poster.name} accepted you for "${s.title}"`, time: "", link: `/tasks/${_id}`, read: s.status === "completed", createdAt: acceptedAt, updatedAt: acceptedAt, __v: 0 });
    }

    // Payments.
    if (s.pay && worker) {
      const heldAt = new Date(appliedBase.getTime() + 60 * MIN);
      payments.push({
        _id: new ObjectId(), taskId: _id, payerId: poster._id, payeeId: worker._id, payeeName: worker.name, amount: s.budget,
        status: s.pay, releasedAt: s.pay === "released" ? completedAt : undefined, createdAt: heldAt, updatedAt: completedAt ?? heldAt, __v: 0,
      });
      notifications.push({ _id: new ObjectId(), userId: worker._id, type: "payment", title: "Payment secured in escrow", description: `₹${s.budget} for "${s.title}" is held. You can start the work.`, time: "", link: `/tasks/${_id}`, read: s.pay === "released", createdAt: heldAt, updatedAt: heldAt, __v: 0 });
      if (s.pay === "released" && completedAt) {
        notifications.push({ _id: new ObjectId(), userId: worker._id, type: "payment", title: "Payment released", description: `₹${s.budget} for "${s.title}" has been released to you.`, time: "", link: `/tasks/${_id}`, read: true, createdAt: completedAt, updatedAt: completedAt, __v: 0 });
        addMessages(s.poster, s.worker!, s.done ?? CHAT[s.cat].done, new Date(completedAt.getTime() - 3 * 3600_000), 30);
      }
    }
    if (s.status === "in_progress" && s.workerDone && worker) {
      const at = ago(70);
      notifications.push({ _id: new ObjectId(), userId: poster._id, type: "status", title: "Work marked as done", description: `${worker.name} finished "${s.title}". Release the payment to complete it.`, time: "", link: `/tasks/${_id}`, read: false, createdAt: at, updatedAt: at, __v: 0 });
      addMessages(s.poster, s.worker!, s.done ?? [], new Date(now - 75 * MIN), 20);
    }
    if (s.status === "expired" && expiredAt) {
      notifications.push({ _id: new ObjectId(), userId: poster._id, type: "status", title: "No one picked up your task", description: `Nobody applied to "${s.title}" in time. Repost it to keep searching.`, time: "", link: `/tasks/${_id}`, read: false, createdAt: expiredAt, updatedAt: expiredAt, __v: 0 });
    }
    void i;
  });

  // Conversations + messages.
  const conversations: any[] = [], messages: any[] = [];
  for (const c of convos.values()) {
    const msgs = c.msgs.sort((x, y) => x.at.getTime() - y.at.getTime());
    if (msgs.length === 0) continue;
    const cid = new ObjectId();
    const last = msgs[msgs.length - 1];
    conversations.push({ _id: cid, participantIds: [user[c.a]._id, user[c.b]._id], lastMessage: last.text, lastTime: iso(last.at), createdAt: msgs[0].at, updatedAt: last.at, __v: 0 });
    for (const m of msgs) messages.push({ _id: new ObjectId(), conversationId: cid, senderId: user[m.from]._id, text: m.text, time: "", createdAt: m.at, updatedAt: m.at, __v: 0 });
    // One collapsed "new message" notification for the recipient of the last message when it's fresh.
    const recipient = last.from === c.a ? c.b : c.a;
    notifications.push({ _id: new ObjectId(), userId: user[recipient]._id, type: "message", title: `New message from ${NAMES[last.from]}`, description: last.text.slice(0, 300), time: "", link: `/messages?conversationId=${cid}`, read: now - last.at.getTime() > 24 * 3600_000, createdAt: last.at, updatedAt: last.at, __v: 0 });
  }

  await db.collection("tasks").insertMany(tasks);
  await db.collection("applications").insertMany(applications);
  if (payments.length) await db.collection("payments").insertMany(payments);
  await db.collection("conversations").insertMany(conversations);
  await db.collection("messages").insertMany(messages);
  await db.collection("notifications").insertMany(notifications);

  const byCat: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const t of tasks) {
    byCat[t.category] = (byCat[t.category] ?? 0) + 1;
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
  }
  console.log("\nSeeded:", { tasks: tasks.length, applications: applications.length, payments: payments.length, conversations: conversations.length, messages: messages.length, notifications: notifications.length });
  console.log("By category:", byCat);
  console.log("By status:  ", byStatus);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Seeding failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
