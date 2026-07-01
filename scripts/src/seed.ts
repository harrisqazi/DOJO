import { db, disciplinesTable, formsTable, posturesTable, jointsTable } from "@workspace/db";

async function seed() {
  console.log("Seeding Tai Chi Yang-24 Form data...");

  // 1. Create discipline
  const [discipline] = await db.insert(disciplinesTable).values({
    slug: "tai-chi",
    name: "Tai Chi",
    description: "Traditional Chinese martial art emphasizing slow, deliberate movements and internal energy cultivation.",
    is_public: true,
    sort_order: 0,
  }).onConflictDoNothing().returning();

  if (!discipline) {
    const [existing] = await db.select().from(disciplinesTable);
    if (!existing) { console.log("No discipline, aborting"); return; }
    console.log("Using existing discipline:", existing.name);
  }

  const discId = discipline?.id ?? (await db.select().from(disciplinesTable))[0].id;

  // 2. Create form
  const [form] = await db.insert(formsTable).values({
    discipline_id: discId,
    slug: "yang-24",
    name: "Yang-24 Tai Chi Form",
    description: "The internationally recognized simplified 24-form Tai Chi sequence, ideal for beginners and lifelong practitioners.",
    difficulty: "beginner",
    camera_default: "side-left",
    estimated_minutes: 6,
    is_free: true,
    sort_order: 0,
    recording_count: 0,
  }).onConflictDoNothing().returning();

  if (!form) {
    console.log("Form already exists, skipping postures");
    return;
  }

  console.log("Created form:", form.name);

  // 3. Create the 24 postures
  const POSTURES = [
    { seq: 1, name: "Commencing Form", audio_cue: "Stand naturally, feet shoulder-width apart", tips: "Relax your shoulders, breathe naturally", hold: 3000 },
    { seq: 2, name: "Part the Wild Horse's Mane (Left)", audio_cue: "Step forward left, arms opening like wings", tips: "Keep your back heel down, weight forward", hold: 3000 },
    { seq: 3, name: "Part the Wild Horse's Mane (Right)", audio_cue: "Shift weight, open to the right side", tips: "Mirror the previous posture", hold: 3000 },
    { seq: 4, name: "White Crane Spreads Wings", audio_cue: "Rise on left foot, arms spread", tips: "Balance on one foot, extend your energy outward", hold: 3500 },
    { seq: 5, name: "Brush Knee and Twist Step (Left)", audio_cue: "Brush left knee, push with right palm", tips: "Coordinate the push with your weight shift", hold: 3000 },
    { seq: 6, name: "Brush Knee and Twist Step (Right)", audio_cue: "Brush right knee, push with left palm", tips: "Sink into your back leg", hold: 3000 },
    { seq: 7, name: "Hand Strums the Lute", audio_cue: "Weight back, hands in lute position", tips: "Both hands should be relaxed and curved", hold: 3000 },
    { seq: 8, name: "Deflect Downward Parry and Punch", audio_cue: "Block low, punch straight forward", tips: "The punch originates from the hip rotation", hold: 3000 },
    { seq: 9, name: "Apparent Close Up", audio_cue: "Draw hands back, then push forward", tips: "Imagine pushing against gentle resistance", hold: 3000 },
    { seq: 10, name: "Cross Hands", audio_cue: "Cross wrists in front of chest", tips: "Feet parallel, shoulder-width apart", hold: 3000 },
    { seq: 11, name: "Embrace Tiger Return to Mountain", audio_cue: "Step back-right, arms hugging", tips: "Shift smoothly as you step", hold: 3000 },
    { seq: 12, name: "Fist Under Elbow", audio_cue: "Right fist under left elbow", tips: "Balance on your right foot", hold: 3000 },
    { seq: 13, name: "Step Back to Repulse Monkey (Left)", audio_cue: "Step back, push forward with open palm", tips: "Keep your push arm at shoulder height", hold: 3000 },
    { seq: 14, name: "Step Back to Repulse Monkey (Right)", audio_cue: "Continue stepping back, alternating hands", tips: "Look over your push hand", hold: 3000 },
    { seq: 15, name: "Diagonal Flying", audio_cue: "Open arms diagonally, weight right", tips: "Imagine spreading your arms like wings", hold: 3000 },
    { seq: 16, name: "Wave Hands Like Clouds (Left)", audio_cue: "Hands wave in front, stepping sideways", tips: "Weight shifts smoothly side to side", hold: 3000 },
    { seq: 17, name: "Wave Hands Like Clouds (Right)", audio_cue: "Continue waving, step right", tips: "Keep movements fluid and continuous", hold: 3000 },
    { seq: 18, name: "Single Whip", audio_cue: "Left palm pushes, right hand forms beak", tips: "The beak hand is formed by fingertips touching", hold: 3500 },
    { seq: 19, name: "High Pat on Horse", audio_cue: "Right palm pushes forward at head height", tips: "Imagine patting a tall horse's flank", hold: 3000 },
    { seq: 20, name: "Kick with Right Heel", audio_cue: "Raise right knee, kick slowly outward", tips: "Support leg is slightly bent, core engaged", hold: 3500 },
    { seq: 21, name: "Strike Tiger", audio_cue: "Both fists circle outward defensively", tips: "Powerful movement with controlled breath", hold: 3000 },
    { seq: 22, name: "Twin Peaks Pierce the Ears", audio_cue: "Both fists strike toward the temples", tips: "Sink slightly as you strike", hold: 3000 },
    { seq: 23, name: "Turn and Kick with Left Heel", audio_cue: "Pivot, raise left knee, kick outward", tips: "Turn smoothly before raising the knee", hold: 3500 },
    { seq: 24, name: "Closing Form", audio_cue: "Lower arms slowly, return to standing", tips: "Bring awareness back to your breathing", hold: 4000 },
  ];

  const JOINTS_PER_POSTURE = [
    // spine, front_knee, rear_knee, left_elbow, right_elbow, right_spine
    [
      { joint_id: "spine", joint_label: "Spine upright", landmark_a: "LEFT_SHOULDER", landmark_b: "LEFT_HIP", landmark_c: "LEFT_KNEE", target_angle: 175, tolerance: 15, weight: 0.35 },
      { joint_id: "right_spine", joint_label: "Right spine alignment", landmark_a: "RIGHT_SHOULDER", landmark_b: "RIGHT_HIP", landmark_c: "RIGHT_KNEE", target_angle: 175, tolerance: 15, weight: 0.35 },
      { joint_id: "left_elbow", joint_label: "Left arm position", landmark_a: "LEFT_SHOULDER", landmark_b: "LEFT_ELBOW", landmark_c: "LEFT_WRIST", target_angle: 165, tolerance: 20, weight: 0.15 },
      { joint_id: "right_elbow", joint_label: "Right arm position", landmark_a: "RIGHT_SHOULDER", landmark_b: "RIGHT_ELBOW", landmark_c: "RIGHT_WRIST", target_angle: 165, tolerance: 20, weight: 0.15 },
    ],
    [
      { joint_id: "spine", joint_label: "Spine upright", landmark_a: "LEFT_SHOULDER", landmark_b: "LEFT_HIP", landmark_c: "LEFT_KNEE", target_angle: 168, tolerance: 15, weight: 0.25 },
      { joint_id: "front_knee", joint_label: "Front knee bend", landmark_a: "LEFT_HIP", landmark_b: "LEFT_KNEE", landmark_c: "LEFT_ANKLE", target_angle: 145, tolerance: 15, weight: 0.30 },
      { joint_id: "rear_knee", joint_label: "Back leg straightness", landmark_a: "RIGHT_HIP", landmark_b: "RIGHT_KNEE", landmark_c: "RIGHT_ANKLE", target_angle: 170, tolerance: 10, weight: 0.25 },
      { joint_id: "left_elbow", joint_label: "Lead arm extension", landmark_a: "LEFT_SHOULDER", landmark_b: "LEFT_ELBOW", landmark_c: "LEFT_WRIST", target_angle: 155, tolerance: 20, weight: 0.20 },
    ],
    [
      { joint_id: "spine", joint_label: "Spine upright", landmark_a: "RIGHT_SHOULDER", landmark_b: "RIGHT_HIP", landmark_c: "RIGHT_KNEE", target_angle: 168, tolerance: 15, weight: 0.25 },
      { joint_id: "front_knee", joint_label: "Front knee bend", landmark_a: "RIGHT_HIP", landmark_b: "RIGHT_KNEE", landmark_c: "RIGHT_ANKLE", target_angle: 145, tolerance: 15, weight: 0.30 },
      { joint_id: "rear_knee", joint_label: "Back leg straightness", landmark_a: "LEFT_HIP", landmark_b: "LEFT_KNEE", landmark_c: "LEFT_ANKLE", target_angle: 170, tolerance: 10, weight: 0.25 },
      { joint_id: "right_elbow", joint_label: "Lead arm extension", landmark_a: "RIGHT_SHOULDER", landmark_b: "RIGHT_ELBOW", landmark_c: "RIGHT_WRIST", target_angle: 155, tolerance: 20, weight: 0.20 },
    ],
    [
      { joint_id: "spine", joint_label: "Spine upright", landmark_a: "LEFT_SHOULDER", landmark_b: "LEFT_HIP", landmark_c: "LEFT_KNEE", target_angle: 175, tolerance: 12, weight: 0.35 },
      { joint_id: "left_elbow", joint_label: "Upper arm raised", landmark_a: "LEFT_SHOULDER", landmark_b: "LEFT_ELBOW", landmark_c: "LEFT_WRIST", target_angle: 150, tolerance: 20, weight: 0.35 },
      { joint_id: "right_elbow", joint_label: "Lower arm extended", landmark_a: "RIGHT_SHOULDER", landmark_b: "RIGHT_ELBOW", landmark_c: "RIGHT_WRIST", target_angle: 160, tolerance: 20, weight: 0.30 },
    ],
  ];

  for (const p of POSTURES) {
    const [posture] = await db.insert(posturesTable).values({
      form_id: form.id,
      sequence_number: p.seq,
      name: p.name,
      audio_cue_text: p.audio_cue,
      tips: p.tips,
      hold_duration_ms: p.hold,
      transition_duration_ms: 1500,
    }).returning();

    const jointTemplate = JOINTS_PER_POSTURE[Math.min(p.seq - 1, JOINTS_PER_POSTURE.length - 1)];
    for (const j of jointTemplate) {
      await db.insert(jointsTable).values({
        posture_id: posture.id,
        joint_id: j.joint_id,
        joint_label: j.joint_label,
        landmark_a: j.landmark_a,
        landmark_b: j.landmark_b,
        landmark_c: j.landmark_c,
        target_angle: j.target_angle,
        tolerance_degrees: j.tolerance,
        weight: j.weight,
        cue_too_low: `Lower your ${j.joint_label.toLowerCase()}`,
        cue_too_high: `Raise your ${j.joint_label.toLowerCase()}`,
        cue_correct: `Good ${j.joint_label.toLowerCase()}`,
      });
    }

    console.log(`  Seeded posture ${p.seq}: ${p.name}`);
  }

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
